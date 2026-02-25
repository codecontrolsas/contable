/**
 * Integración del módulo de equipos con contabilidad
 *
 * Genera asientos contables para operaciones de activos fijos:
 *
 * 1. Alta de activo fijo (capitalización):
 *    - Debe: Bienes de Uso (fixedAssetAccount)
 *    - Haber: Cuentas por Pagar (payablesAccount)
 *
 * 2. Depreciación periódica:
 *    - Debe: Gasto de Depreciación (depreciationExpenseAccount)
 *    - Haber: Depreciación Acumulada (accumulatedDepreciationAccount)
 *
 * 3. Baja por venta:
 *    - Debe: Depreciación Acumulada (total acumulado)
 *    - Debe/Haber: Resultado venta bienes de uso (ganancia/pérdida)
 *    - Haber: Bienes de Uso (valor bruto)
 *
 * 4. Baja por pérdida total/devolución:
 *    - Debe: Depreciación Acumulada (total acumulado)
 *    - Debe: Resultado por baja (valor libro restante)
 *    - Haber: Bienes de Uso (valor bruto)
 */

import moment from 'moment';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';

// Tipo para el cliente de transacción de Prisma
type PrismaTransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ============================================
// HELPER: Obtener configuración contable de equipos
// ============================================

async function getEquipmentAccountingSettings(companyId: string, tx?: PrismaTransactionClient) {
  const client = tx || prisma;

  const settings = await client.accountingSettings.findUnique({
    where: { companyId },
    select: {
      fixedAssetAccountId: true,
      accumulatedDepreciationAccountId: true,
      depreciationExpenseAccountId: true,
      assetDisposalGainLossAccountId: true,
      payablesAccountId: true,
      lastEntryNumber: true,
    },
  });

  return settings;
}

// ============================================
// HELPER: Crear asiento contable
// ============================================

interface JournalEntryLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

async function createJournalEntry(
  input: {
    companyId: string;
    date: Date;
    description: string;
    lines: JournalEntryLineInput[];
  },
  tx: PrismaTransactionClient,
): Promise<string | null> {
  const { companyId, date, description, lines } = input;

  // Validar balance
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `El asiento no está balanceado. Debe: ${totalDebit.toFixed(2)}, Haber: ${totalCredit.toFixed(2)}`,
    );
  }

  const settings = await tx.accountingSettings.findUnique({
    where: { companyId },
    select: { lastEntryNumber: true, lockedUntilDate: true },
  });

  if (!settings) {
    throw new Error('No se encontró configuración contable');
  }

  // Verificar bloqueo de período
  if (settings.lockedUntilDate && moment(date).isSameOrBefore(moment(settings.lockedUntilDate), 'day')) {
    logger.warn('Asiento de equipos omitido por período bloqueado', {
      data: { companyId, date, description, lockedUntil: settings.lockedUntilDate },
    });
    return null;
  }

  const nextNumber = settings.lastEntryNumber + 1;

  const entry = await tx.journalEntry.create({
    data: {
      companyId,
      number: nextNumber,
      date,
      description,
      createdBy: 'system',
      lines: {
        create: lines.map((line) => ({
          accountId: line.accountId,
          debit: new Prisma.Decimal(line.debit),
          credit: new Prisma.Decimal(line.credit),
          description: line.description,
        })),
      },
    },
  });

  await tx.accountingSettings.update({
    where: { companyId },
    data: { lastEntryNumber: nextNumber },
  });

  logger.info('Asiento contable de equipos creado', {
    data: { entryId: entry.id, number: nextNumber, description },
  });

  return entry.id;
}

// ============================================
// INTEGRACIÓN: Baja de activo por venta
// ============================================

/**
 * Genera asiento de baja de activo fijo por venta.
 * El ingreso por venta se registra vía factura de venta (integración comercial).
 */
export async function createJournalEntryForAssetSale(
  vehicleId: string,
  companyId: string,
  tx: PrismaTransactionClient,
) {
  const settings = await getEquipmentAccountingSettings(companyId, tx);

  if (
    !settings?.fixedAssetAccountId ||
    !settings?.accumulatedDepreciationAccountId ||
    !settings?.assetDisposalGainLossAccountId
  ) {
    logger.warn('Cuentas de activos fijos no configuradas - asiento de baja omitido', {
      data: { vehicleId },
    });
    return null;
  }

  const depreciation = await tx.vehicleDepreciation.findUnique({
    where: { vehicleId },
    include: {
      vehicle: { select: { internNumber: true, domain: true } },
    },
  });

  if (!depreciation) {
    logger.warn('Equipo sin depreciación configurada - asiento de baja omitido', {
      data: { vehicleId },
    });
    return null;
  }

  const grossValue = Number(depreciation.grossValue);
  const totalDepreciated = Number(depreciation.totalDepreciated);
  const bookValue = Number(depreciation.currentBookValue);
  const vehicleLabel =
    depreciation.vehicle.internNumber || depreciation.vehicle.domain || vehicleId.slice(0, 8);

  const lines: JournalEntryLineInput[] = [
    // Reversar depreciación acumulada
    {
      accountId: settings.accumulatedDepreciationAccountId,
      debit: totalDepreciated,
      credit: 0,
      description: `Baja dep. acumulada - Equipo ${vehicleLabel}`,
    },
    // Reversar bien de uso
    {
      accountId: settings.fixedAssetAccountId,
      debit: 0,
      credit: grossValue,
      description: `Baja bien de uso - Equipo ${vehicleLabel}`,
    },
  ];

  // Si hay valor libro restante, registrar como pérdida por baja
  if (bookValue > 0) {
    lines.push({
      accountId: settings.assetDisposalGainLossAccountId,
      debit: bookValue,
      credit: 0,
      description: `Resultado por venta - Equipo ${vehicleLabel}`,
    });
  }

  const entryId = await createJournalEntry(
    {
      companyId,
      date: new Date(),
      description: `Baja por venta de activo fijo: Equipo ${vehicleLabel}`,
      lines,
    },
    tx,
  );

  return entryId;
}

// ============================================
// INTEGRACIÓN: Baja de activo por pérdida/devolución
// ============================================

/**
 * Genera asiento de baja de activo fijo por pérdida total o devolución
 */
export async function createJournalEntryForAssetDisposal(
  vehicleId: string,
  companyId: string,
  tx: PrismaTransactionClient,
) {
  const settings = await getEquipmentAccountingSettings(companyId, tx);

  if (
    !settings?.fixedAssetAccountId ||
    !settings?.accumulatedDepreciationAccountId ||
    !settings?.assetDisposalGainLossAccountId
  ) {
    logger.warn('Cuentas de activos fijos no configuradas - asiento de baja omitido', {
      data: { vehicleId },
    });
    return null;
  }

  const depreciation = await tx.vehicleDepreciation.findUnique({
    where: { vehicleId },
    include: {
      vehicle: { select: { internNumber: true, domain: true } },
    },
  });

  if (!depreciation) {
    logger.warn('Equipo sin depreciación configurada - asiento de baja omitido', {
      data: { vehicleId },
    });
    return null;
  }

  const grossValue = Number(depreciation.grossValue);
  const totalDepreciated = Number(depreciation.totalDepreciated);
  const bookValue = Number(depreciation.currentBookValue);
  const vehicleLabel =
    depreciation.vehicle.internNumber || depreciation.vehicle.domain || vehicleId.slice(0, 8);

  const lines: JournalEntryLineInput[] = [
    // Reversar depreciación acumulada
    {
      accountId: settings.accumulatedDepreciationAccountId,
      debit: totalDepreciated,
      credit: 0,
      description: `Baja dep. acumulada - Equipo ${vehicleLabel}`,
    },
    // Reversar bien de uso
    {
      accountId: settings.fixedAssetAccountId,
      debit: 0,
      credit: grossValue,
      description: `Baja bien de uso - Equipo ${vehicleLabel}`,
    },
  ];

  // Si hay valor libro restante, registrar como pérdida
  if (bookValue > 0) {
    lines.push({
      accountId: settings.assetDisposalGainLossAccountId,
      debit: bookValue,
      credit: 0,
      description: `Pérdida por baja - Equipo ${vehicleLabel}`,
    });
  }

  const entryId = await createJournalEntry(
    {
      companyId,
      date: new Date(),
      description: `Baja por ${bookValue > 0 ? 'pérdida total' : 'devolución'} de activo fijo: Equipo ${vehicleLabel}`,
      lines,
    },
    tx,
  );

  return entryId;
}
