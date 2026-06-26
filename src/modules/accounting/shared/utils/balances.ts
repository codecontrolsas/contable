'use server';

import { prisma } from '@/shared/lib/prisma';
import moment from 'moment';
import { logger } from '@/shared/lib/logger';

/**
 * Calcula el saldo de una cuenta hasta una fecha específica
 */
export async function calculateAccountBalance(
  accountId: string,
  companyId: string,
  upToDate?: Date
): Promise<{ debit: number; credit: number; balance: number }> {
  try {
    const whereCondition: any = {
      accountId,
      entry: {
        companyId,
        status: 'POSTED', // Solo asientos registrados
      },
    };

    if (upToDate) {
      whereCondition.entry.date = {
        lte: upToDate,
      };
    }

    const lines = await prisma.journalEntryLine.findMany({
      where: whereCondition,
      select: {
        debit: true,
        credit: true,
      },
    });

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      totalDebit += Number(line.debit);
      totalCredit += Number(line.credit);
    }

    const balance = totalDebit - totalCredit;

    return {
      debit: totalDebit,
      credit: totalCredit,
      balance,
    };
  } catch (error) {
    logger.error('Error calculando saldo de cuenta', {
      data: { accountId, companyId, error },
    });
    throw new Error('Error al calcular el saldo de la cuenta');
  }
}

/**
 * Calcula saldos de todas las cuentas de una empresa (query única optimizada)
 */
export async function calculateAllAccountBalances(
  companyId: string,
  upToDate?: Date
): Promise<Map<string, { debit: number; credit: number; balance: number }>> {
  try {
    const rows = upToDate
      ? await prisma.$queryRaw<{ account_id: string; total_debit: number; total_credit: number }[]>`
          SELECT jel.account_id,
                 COALESCE(SUM(jel.debit), 0)::float AS total_debit,
                 COALESCE(SUM(jel.credit), 0)::float AS total_credit
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel.entry_id
          JOIN accounts a ON a.id = jel.account_id
          WHERE je.company_id = ${companyId}::uuid
            AND je.status = 'POSTED'
            AND je.date <= ${upToDate}
            AND a.company_id = ${companyId}::uuid
            AND a.is_active = true
          GROUP BY jel.account_id
        `
      : await prisma.$queryRaw<{ account_id: string; total_debit: number; total_credit: number }[]>`
          SELECT jel.account_id,
                 COALESCE(SUM(jel.debit), 0)::float AS total_debit,
                 COALESCE(SUM(jel.credit), 0)::float AS total_credit
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel.entry_id
          JOIN accounts a ON a.id = jel.account_id
          WHERE je.company_id = ${companyId}::uuid
            AND je.status = 'POSTED'
            AND a.company_id = ${companyId}::uuid
            AND a.is_active = true
          GROUP BY jel.account_id
        `;

    const balances = new Map<string, { debit: number; credit: number; balance: number }>();

    for (const row of rows) {
      balances.set(row.account_id, {
        debit: row.total_debit,
        credit: row.total_credit,
        balance: row.total_debit - row.total_credit,
      });
    }

    return balances;
  } catch (error) {
    logger.error('Error calculando saldos de cuentas', {
      data: { companyId, error },
    });
    throw new Error('Error al calcular saldos');
  }
}

/**
 * Calcula balance por tipo de cuenta (query única optimizada)
 */
export async function calculateBalanceByType(
  companyId: string,
  upToDate?: Date
): Promise<Record<string, number>> {
  try {
    const rows = upToDate
      ? await prisma.$queryRaw<{ account_type: string; total_balance: number }[]>`
          SELECT a.type AS account_type,
                 COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)::float AS total_balance
          FROM accounts a
          JOIN journal_entry_lines jel ON jel.account_id = a.id
          JOIN journal_entries je ON je.id = jel.entry_id
          WHERE a.company_id = ${companyId}::uuid
            AND a.is_active = true
            AND je.company_id = ${companyId}::uuid
            AND je.status = 'POSTED'
            AND je.date <= ${upToDate}
          GROUP BY a.type
        `
      : await prisma.$queryRaw<{ account_type: string; total_balance: number }[]>`
          SELECT a.type AS account_type,
                 COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)::float AS total_balance
          FROM accounts a
          JOIN journal_entry_lines jel ON jel.account_id = a.id
          JOIN journal_entries je ON je.id = jel.entry_id
          WHERE a.company_id = ${companyId}::uuid
            AND a.is_active = true
            AND je.company_id = ${companyId}::uuid
            AND je.status = 'POSTED'
          GROUP BY a.type
        `;

    const balancesByType: Record<string, number> = {
      ASSET: 0,
      LIABILITY: 0,
      EQUITY: 0,
      REVENUE: 0,
      EXPENSE: 0,
    };

    for (const row of rows) {
      balancesByType[row.account_type] = row.total_balance;
    }

    return balancesByType;
  } catch (error) {
    logger.error('Error calculando balance por tipo', {
      data: { companyId, error },
    });
    throw new Error('Error al calcular balance por tipo');
  }
}

/**
 * Calcula saldo inicial de una cuenta al inicio de un período
 */
export async function calculateOpeningBalance(
  accountId: string,
  companyId: string,
  periodStart: Date
): Promise<number> {
  const beforePeriodEnd = moment(periodStart).subtract(1, 'day').toDate();

  const balance = await calculateAccountBalance(
    accountId,
    companyId,
    beforePeriodEnd
  );

  return balance.balance;
}

/**
 * Verifica la ecuación contable fundamental: Activo = Pasivo + Patrimonio
 */
export async function verifyAccountingEquation(
  companyId: string,
  upToDate?: Date
): Promise<{
  isBalanced: boolean;
  assets: number;
  liabilities: number;
  equity: number;
  difference: number;
}> {
  const balances = await calculateBalanceByType(companyId, upToDate);

  const assets = balances.ASSET;
  const liabilities = balances.LIABILITY;
  const equity = balances.EQUITY;

  const leftSide = assets;
  const rightSide = liabilities + equity;
  const difference = leftSide - rightSide;

  const isBalanced = Math.abs(difference) < 0.01;

  if (!isBalanced) {
    logger.warn('Ecuación contable desbalanceada', {
      data: {
        companyId,
        assets,
        liabilities,
        equity,
        difference,
      },
    });
  }

  return {
    isBalanced,
    assets,
    liabilities,
    equity,
    difference,
  };
}
