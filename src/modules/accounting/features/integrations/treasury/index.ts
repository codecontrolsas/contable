/**
 * Integración automática de tesorería con contabilidad
 *
 * Genera asientos contables automáticamente para operaciones de tesorería
 * que no están cubiertas por el puente comercial (recibos y OP):
 *
 * 1. Transferencia bancaria:
 *    D: Banco destino / H: Banco origen
 *
 * 2. Depósito de cheque de tercero:
 *    D: Banco / H: Valores a depositar
 *
 * 3. Rechazo de cheque depositado:
 *    D: Deudores por cheques rechazados / H: Banco
 */

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';

type PrismaTransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function getAccountingSettings(companyId: string, tx: PrismaTransactionClient) {
  const settings = await tx.accountingSettings.findUnique({
    where: { companyId },
    select: {
      lockedUntilDate: true,
      defaultBankAccountId: true,
      checksReceivedAccountId: true,
      checksRejectedAccountId: true,
    },
  });

  if (!settings) throw new Error('No se encontró configuración contable');
  return settings;
}

async function createJournalEntry(
  companyId: string,
  date: Date,
  description: string,
  lines: { accountId: string; debit: number; credit: number; description: string }[],
  tx: PrismaTransactionClient
): Promise<string | null> {
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Asiento no balanceado. Debe: ${totalDebit.toFixed(2)}, Haber: ${totalCredit.toFixed(2)}`
    );
  }

  const settings = await tx.accountingSettings.findUnique({
    where: { companyId },
    select: { lockedUntilDate: true },
  });

  if (settings?.lockedUntilDate && date <= settings.lockedUntilDate) {
    logger.warn('Período cerrado, no se genera asiento', { data: { companyId, date } });
    return null;
  }

  const fiscalYear = await tx.fiscalYear.findFirst({
    where: { companyId, startDate: { lte: date }, endDate: { gte: date } },
    select: { id: true },
  });

  let periodId: string | undefined;
  if (fiscalYear) {
    const d = new Date(date);
    const period = await tx.accountingPeriod.findFirst({
      where: {
        fiscalYearId: fiscalYear.id,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        type: 'MONTHLY',
      },
      select: { id: true },
    });
    periodId = period?.id;
  }

  const [{ last_entry_number: nextNumber }] = await tx.$queryRaw<[{ last_entry_number: number }]>`
    UPDATE accounting_settings
    SET last_entry_number = last_entry_number + 1, updated_at = NOW()
    WHERE company_id = ${companyId}::uuid
    RETURNING last_entry_number
  `;

  const entry = await tx.journalEntry.create({
    data: {
      companyId,
      number: nextNumber,
      date,
      description,
      createdBy: 'system',
      fiscalYearId: fiscalYear?.id,
      periodId,
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: new Prisma.Decimal(l.debit),
          credit: new Prisma.Decimal(l.credit),
          description: l.description,
        })),
      },
    },
  });

  logger.info('Asiento contable tesorería creado', {
    data: { entryId: entry.id, number: nextNumber },
  });

  return entry.id;
}

// ============================================
// TRANSFERENCIA BANCARIA
// ============================================

export async function createJournalEntryForBankTransfer(
  bankMovementId: string,
  destinationBankAccountId: string,
  companyId: string,
  tx: PrismaTransactionClient
): Promise<string | null> {
  try {
    const movement = await tx.bankMovement.findUnique({
      where: { id: bankMovementId },
      select: {
        date: true,
        amount: true,
        description: true,
        bankAccount: {
          select: { accountId: true, bankName: true, accountNumber: true },
        },
      },
    });

    if (!movement) throw new Error('Movimiento bancario no encontrado');

    const destinationBank = await tx.bankAccount.findUnique({
      where: { id: destinationBankAccountId },
      select: { accountId: true, bankName: true, accountNumber: true },
    });

    if (!destinationBank) throw new Error('Banco destino no encontrado');

    const originAccountId = movement.bankAccount.accountId;
    const destAccountId = destinationBank.accountId;

    if (!originAccountId || !destAccountId) {
      logger.warn('Bancos sin cuenta contable vinculada, no se genera asiento', {
        data: { bankMovementId, originAccountId, destAccountId },
      });
      return null;
    }

    const amount = Number(movement.amount);

    return createJournalEntry(
      companyId,
      movement.date,
      `Transferencia: ${movement.bankAccount.bankName} → ${destinationBank.bankName}`,
      [
        {
          accountId: destAccountId,
          debit: amount,
          credit: 0,
          description: `Transferencia desde ${movement.bankAccount.bankName} ${movement.bankAccount.accountNumber}`,
        },
        {
          accountId: originAccountId,
          debit: 0,
          credit: amount,
          description: `Transferencia a ${destinationBank.bankName} ${destinationBank.accountNumber}`,
        },
      ],
      tx
    );
  } catch (error) {
    logger.error('Error al crear asiento de transferencia bancaria', {
      data: { error, bankMovementId },
    });
    return null;
  }
}

// ============================================
// DEPÓSITO DE CHEQUE DE TERCERO
// ============================================

export async function createJournalEntryForCheckDeposit(
  checkId: string,
  companyId: string,
  tx: PrismaTransactionClient
): Promise<string | null> {
  try {
    const settings = await getAccountingSettings(companyId, tx);

    if (!settings.checksReceivedAccountId) {
      logger.warn('Cuenta de valores a depositar no configurada', {
        data: { companyId, checkId },
      });
      return null;
    }

    const check = await tx.check.findUnique({
      where: { id: checkId },
      select: {
        checkNumber: true,
        bankName: true,
        amount: true,
        depositedAt: true,
        bankAccount: {
          select: { accountId: true, bankName: true },
        },
      },
    });

    if (!check) throw new Error('Cheque no encontrado');

    const bankAccountId = check.bankAccount?.accountId;
    if (!bankAccountId) {
      logger.warn('Banco de depósito sin cuenta contable', { data: { checkId } });
      return null;
    }

    const amount = Number(check.amount);
    const depositDate = check.depositedAt ?? new Date();

    return createJournalEntry(
      companyId,
      depositDate,
      `Depósito cheque Nº ${check.checkNumber} — ${check.bankName}`,
      [
        {
          accountId: bankAccountId,
          debit: amount,
          credit: 0,
          description: `Depósito cheque ${check.checkNumber} en ${check.bankAccount?.bankName}`,
        },
        {
          accountId: settings.checksReceivedAccountId,
          debit: 0,
          credit: amount,
          description: `Cheque Nº ${check.checkNumber} — ${check.bankName}`,
        },
      ],
      tx
    );
  } catch (error) {
    logger.error('Error al crear asiento de depósito de cheque', {
      data: { error, checkId },
    });
    return null;
  }
}

// ============================================
// RECHAZO DE CHEQUE
// ============================================

export async function createJournalEntryForCheckRejection(
  checkId: string,
  companyId: string,
  tx: PrismaTransactionClient
): Promise<string | null> {
  try {
    const settings = await getAccountingSettings(companyId, tx);

    if (!settings.checksRejectedAccountId) {
      logger.warn('Cuenta de deudores por cheques rechazados no configurada', {
        data: { companyId, checkId },
      });
      return null;
    }

    const check = await tx.check.findUnique({
      where: { id: checkId },
      select: {
        checkNumber: true,
        bankName: true,
        amount: true,
        rejectedAt: true,
        bankAccount: {
          select: { accountId: true, bankName: true },
        },
      },
    });

    if (!check) throw new Error('Cheque no encontrado');

    const bankAccountId = check.bankAccount?.accountId;
    if (!bankAccountId) {
      logger.warn('Banco sin cuenta contable para rechazo de cheque', { data: { checkId } });
      return null;
    }

    const amount = Number(check.amount);
    const rejectedDate = check.rejectedAt ?? new Date();

    return createJournalEntry(
      companyId,
      rejectedDate,
      `Rechazo cheque Nº ${check.checkNumber} — ${check.bankName}`,
      [
        {
          accountId: settings.checksRejectedAccountId,
          debit: amount,
          credit: 0,
          description: `Cheque rechazado Nº ${check.checkNumber} — ${check.bankName}`,
        },
        {
          accountId: bankAccountId,
          debit: 0,
          credit: amount,
          description: `Cheque rechazado Nº ${check.checkNumber}`,
        },
      ],
      tx
    );
  } catch (error) {
    logger.error('Error al crear asiento de rechazo de cheque', {
      data: { error, checkId },
    });
    return null;
  }
}
