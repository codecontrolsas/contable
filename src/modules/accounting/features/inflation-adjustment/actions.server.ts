'use server';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import { revalidatePath } from 'next/cache';
import moment from 'moment';

// ============================================
// CRUD DE ÍNDICES DE INFLACIÓN
// ============================================

export async function getInflationIndices(year?: number) {
  await checkPermission('accounting.settings', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const indices = await prisma.inflationIndex.findMany({
      where: {
        companyId,
        ...(year && { year }),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return indices.map((i) => ({
      id: i.id,
      year: i.year,
      month: i.month,
      index: Number(i.index),
    }));
  } catch (error) {
    logger.error('Error al obtener índices de inflación', { data: { error, companyId } });
    throw error;
  }
}

interface SaveIndexInput {
  year: number;
  month: number;
  index: number;
}

export async function saveInflationIndex(input: SaveIndexInput) {
  await checkPermission('accounting.settings', 'create', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const result = await prisma.inflationIndex.upsert({
      where: {
        companyId_year_month: {
          companyId,
          year: input.year,
          month: input.month,
        },
      },
      update: { index: input.index },
      create: {
        companyId,
        year: input.year,
        month: input.month,
        index: input.index,
      },
      select: { id: true },
    });

    logger.info('Índice de inflación guardado', {
      data: { companyId, year: input.year, month: input.month, index: input.index },
    });

    revalidatePath('/dashboard/company/accounting/inflation');
    return result;
  } catch (error) {
    logger.error('Error al guardar índice de inflación', { data: { error, companyId } });
    throw error;
  }
}

export async function importInflationIndices(indices: SaveIndexInput[]) {
  await checkPermission('accounting.settings', 'create', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    let saved = 0;
    for (const idx of indices) {
      await prisma.inflationIndex.upsert({
        where: {
          companyId_year_month: { companyId, year: idx.year, month: idx.month },
        },
        update: { index: idx.index },
        create: { companyId, year: idx.year, month: idx.month, index: idx.index },
      });
      saved++;
    }

    logger.info('Índices de inflación importados', {
      data: { companyId, total: saved },
    });

    revalidatePath('/dashboard/company/accounting/inflation');
    return { total: saved };
  } catch (error) {
    logger.error('Error al importar índices', { data: { error, companyId } });
    throw error;
  }
}

// ============================================
// CÁLCULO RECPAM
// ============================================

interface RECPAMLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  openingBalance: number;
  closingBalance: number;
  adjustedBalance: number;
  recpam: number;
  coefficient: number;
}

export async function calculateRECPAM(
  year: number,
  month: number
): Promise<RECPAMLine[]> {
  await checkPermission('accounting.reports', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Obtener IPC del mes de cierre
    const closingIndex = await prisma.inflationIndex.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });

    if (!closingIndex) {
      throw new Error(`No hay índice de inflación cargado para ${month}/${year}`);
    }

    // Obtener cuentas ajustables
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        adjustableByInflation: true,
        isLeaf: true,
      },
      select: { id: true, code: true, name: true, nature: true },
      orderBy: { code: 'asc' },
    });

    if (accounts.length === 0) return [];

    const endDate = moment(`${year}-${month}-01`, 'YYYY-M-DD').endOf('month').toDate();
    const startDate = moment(`${year}-${month}-01`, 'YYYY-M-DD').startOf('month').toDate();

    // Para cada cuenta, obtener saldo de cierre y calcular ajuste
    const accountIds = accounts.map((a) => a.id);

    // Obtener saldos de cierre (hasta fin de mes)
    const closingBalances = await prisma.$queryRaw<
      { account_id: string; balance: number }[]
    >`
      SELECT
        jel.account_id,
        (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::float AS balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
      WHERE je.company_id = ${companyId}::uuid
        AND je.status = 'POSTED'
        AND je.date <= ${endDate}
        AND jel.account_id = ANY(${accountIds}::uuid[])
      GROUP BY jel.account_id
    `;

    // Obtener saldos de apertura (hasta inicio de mes)
    const openingBalances = await prisma.$queryRaw<
      { account_id: string; balance: number }[]
    >`
      SELECT
        jel.account_id,
        (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::float AS balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
      WHERE je.company_id = ${companyId}::uuid
        AND je.status = 'POSTED'
        AND je.date < ${startDate}
        AND jel.account_id = ANY(${accountIds}::uuid[])
      GROUP BY jel.account_id
    `;

    const closingMap = new Map(closingBalances.map((b) => [b.account_id, b.balance]));
    const openingMap = new Map(openingBalances.map((b) => [b.account_id, b.balance]));

    // Obtener IPC del mes anterior (o del primer mes disponible para saldos de apertura)
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const originIndex = await prisma.inflationIndex.findUnique({
      where: { companyId_year_month: { companyId, year: prevYear, month: prevMonth } },
    });

    if (!originIndex) {
      throw new Error(`No hay índice de inflación cargado para ${prevMonth}/${prevYear}`);
    }

    const coefficient = Number(closingIndex.index) / Number(originIndex.index);

    const results: RECPAMLine[] = [];

    for (const account of accounts) {
      const openingBalance = openingMap.get(account.id) ?? 0;
      const closingBalance = closingMap.get(account.id) ?? 0;

      if (Math.abs(closingBalance) < 0.01) continue;

      // Reexpresar el saldo contable al IPC de cierre
      const adjustedBalance = closingBalance * coefficient;
      const recpam = adjustedBalance - closingBalance;

      if (Math.abs(recpam) < 0.01) continue;

      results.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        openingBalance,
        closingBalance,
        adjustedBalance: Math.round(adjustedBalance * 100) / 100,
        recpam: Math.round(recpam * 100) / 100,
        coefficient: Math.round(coefficient * 1000000) / 1000000,
      });
    }

    return results;
  } catch (error) {
    logger.error('Error al calcular RECPAM', {
      data: { error, companyId, year, month },
    });
    throw error;
  }
}

// ============================================
// GENERAR ASIENTO DE AJUSTE
// ============================================

export async function generateInflationAdjustmentEntry(year: number, month: number) {
  await checkPermission('accounting.entries', 'create', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const recpamLines = await calculateRECPAM(year, month);

    if (recpamLines.length === 0) {
      throw new Error('No hay ajustes por inflación para generar');
    }

    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
      select: { recpamAccountId: true },
    });

    if (!settings?.recpamAccountId) {
      throw new Error('Configure la cuenta RECPAM antes de generar el ajuste');
    }

    const endDate = moment(`${year}-${month}-01`, 'YYYY-M-DD').endOf('month').toDate();

    const result = await prisma.$transaction(async (tx) => {
      const [{ last_entry_number: nextNumber }] = await tx.$queryRaw<
        [{ last_entry_number: number }]
      >`
        UPDATE accounting_settings
        SET last_entry_number = last_entry_number + 1, updated_at = NOW()
        WHERE company_id = ${companyId}::uuid
        RETURNING last_entry_number
      `;

      const fiscalYear = await tx.fiscalYear.findFirst({
        where: { companyId, startDate: { lte: endDate }, endDate: { gte: endDate } },
        select: { id: true },
      });

      let periodId: string | undefined;
      if (fiscalYear) {
        const period = await tx.accountingPeriod.findFirst({
          where: { fiscalYearId: fiscalYear.id, year, month, type: 'MONTHLY' },
          select: { id: true },
        });
        periodId = period?.id;
      }

      interface EntryLine {
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        description: string;
      }

      const lines: EntryLine[] = [];
      let totalRecpam = 0;

      for (const recpamLine of recpamLines) {
        if (recpamLine.recpam > 0) {
          // Ajuste positivo: el saldo ajustado es mayor
          lines.push({
            accountId: recpamLine.accountId,
            debit: new Prisma.Decimal(recpamLine.recpam),
            credit: new Prisma.Decimal(0),
            description: `RECPAM ${recpamLine.accountCode} — coef. ${recpamLine.coefficient}`,
          });
        } else {
          lines.push({
            accountId: recpamLine.accountId,
            debit: new Prisma.Decimal(0),
            credit: new Prisma.Decimal(Math.abs(recpamLine.recpam)),
            description: `RECPAM ${recpamLine.accountCode} — coef. ${recpamLine.coefficient}`,
          });
        }
        totalRecpam += recpamLine.recpam;
      }

      // Contrapartida RECPAM
      if (totalRecpam > 0) {
        lines.push({
          accountId: settings.recpamAccountId!,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(totalRecpam),
          description: `RECPAM — Resultado por exposición a la inflación ${month}/${year}`,
        });
      } else {
        lines.push({
          accountId: settings.recpamAccountId!,
          debit: new Prisma.Decimal(Math.abs(totalRecpam)),
          credit: new Prisma.Decimal(0),
          description: `RECPAM — Resultado por exposición a la inflación ${month}/${year}`,
        });
      }

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          number: nextNumber,
          date: endDate,
          description: `Ajuste por inflación — RECPAM ${month}/${year}`,
          createdBy: 'system',
          status: 'POSTED',
          postDate: new Date(),
          fiscalYearId: fiscalYear?.id,
          periodId,
          lines: { create: lines },
        },
        select: { id: true, number: true },
      });

      return entry;
    });

    logger.info('Asiento de ajuste por inflación generado', {
      data: {
        companyId,
        entryId: result.id,
        entryNumber: result.number,
        year,
        month,
        cuentasAjustadas: recpamLines.length,
      },
    });

    revalidatePath('/dashboard/company/accounting/entries');

    return result;
  } catch (error) {
    logger.error('Error al generar asiento de ajuste por inflación', {
      data: { error, companyId, year, month },
    });
    throw error;
  }
}
