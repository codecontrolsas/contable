'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/shared/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { AccountNature, AccountType, BudgetStatus, JournalEntryStatus } from '@/generated/prisma/enums';
import moment from 'moment';
import {
  calculateAccountBalance,
  calculateAllAccountBalances,
  verifyAccountingEquation,
} from '../../shared/utils/balances';

interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

interface TrialBalanceResult {
  accounts: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  equation?: {
    isBalanced: boolean;
    assets: number;
    liabilities: number;
    equity: number;
    difference: number;
  };
}

interface JournalBookEntry {
  id: string;
  number: number;
  date: Date;
  description: string;
  status: JournalEntryStatus;
  lines: {
    id: string;
    accountId: string;
    description?: string | null;
    debit: number;
    credit: number;
    account: {
      code: string;
      name: string;
    };
  }[];
}

interface GeneralLedgerAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  entries: {
    date: Date;
    description: string | null;
    debit: number;
    credit: number;
    balance: number;
    entryNumber: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

/**
 * Ajusta la fecha de fin para incluir todo el día
 */
function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Ajusta la fecha de inicio al comienzo del día
 */
function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Obtiene el balance de sumas y saldos
 */
export async function getTrialBalance(companyId: string, fromDate: Date, toDate: Date) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  // Ajustar fechas para incluir todo el rango
  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  try {
    logger.info('Obteniendo balance de sumas y saldos', { data: { companyId, from, to } });

    // Obtener todas las cuentas activas
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    // Usar la función de balances.ts para calcular saldos hasta la fecha final
    const balancesMap = await calculateAllAccountBalances(companyId, to);

    // Convertir a array y agregar información de cuentas
    const balances: AccountBalance[] = accounts
      .map(account => {
        const balance = balancesMap.get(account.id) || { debit: 0, credit: 0, balance: 0 };

        return {
          accountId: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          nature: account.nature,
          debitTotal: balance.debit,
          creditTotal: balance.credit,
          balance: balance.balance,
        };
      })
      // Filtrar cuentas sin movimientos
      .filter(account => account.debitTotal !== 0 || account.creditTotal !== 0);

    // Calcular totales
    const totalDebit = balances.reduce((sum, account) => sum + account.debitTotal, 0);
    const totalCredit = balances.reduce((sum, account) => sum + account.creditTotal, 0);

    // Verificar ecuación contable
    const equation = await verifyAccountingEquation(companyId, to);

    const result = {
      accounts: balances,
      totalDebit,
      totalCredit,
      equation,
    };

    logger.info('Balance calculado', {
      data: {
        accountCount: balances.length,
        totalDebit,
        totalCredit,
        equationBalanced: equation.isBalanced,
      }
    });

    if (!equation.isBalanced) {
      logger.warn('Balance desbalanceado detectado', {
        data: {
          difference: equation.difference,
          assets: equation.assets,
          liabilities: equation.liabilities,
          equity: equation.equity,
        }
      });
    }

    return result;
  } catch (error) {
    logger.error('Error al obtener balance de sumas y saldos', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene el libro diario
 */
export async function getJournalBook(companyId: string, fromDate: Date, toDate: Date) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  // Ajustar fechas para incluir todo el rango
  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  try {
    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId,
        status: JournalEntryStatus.POSTED,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [
        { date: 'asc' },
        { number: 'asc' },
      ],
      include: {
        lines: {
          include: {
            account: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return entries;
  } catch (error) {
    logger.error('Error al obtener libro diario', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene el libro mayor
 */
export async function getGeneralLedger(companyId: string, fromDate: Date, toDate: Date) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  // Ajustar fechas para incluir todo el rango
  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  try {
    // Obtener todas las cuentas activas
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    // Obtener todos los asientos registrados en el período
    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId,
        status: JournalEntryStatus.POSTED,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [
        { date: 'asc' },
        { number: 'asc' },
      ],
      include: {
        lines: true,
      },
    });

    // Procesar cada cuenta
    const ledger: GeneralLedgerAccount[] = accounts.map(account => {
      const movements = entries
        .filter(entry => entry.lines.some(line => line.accountId === account.id))
        .map(entry => {
          const line = entry.lines.find(line => line.accountId === account.id)!;
          return {
            date: entry.date,
            description: entry.description,
            entryNumber: entry.number,
            debit: line.debit,
            credit: line.credit,
          };
        });

      let balance = 0;
      const processedMovements = movements.map(movement => {
        const debit = Number(movement.debit);
        const credit = Number(movement.credit);
        
        // Actualizar balance según naturaleza de la cuenta
        if (account.nature === AccountNature.DEBIT) {
          balance += debit - credit;
        } else {
          balance += credit - debit;
        }

        return {
          date: movement.date,
          description: movement.description,
          debit,
          credit,
          balance,
          entryNumber: movement.entryNumber,
        };
      });

      const totalDebit = movements.reduce((sum, movement) => sum + Number(movement.debit), 0);
      const totalCredit = movements.reduce((sum, movement) => sum + Number(movement.credit), 0);
      const finalBalance = account.nature === AccountNature.DEBIT
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        nature: account.nature,
        entries: processedMovements,
        totalDebit,
        totalCredit,
        balance: finalBalance,
      };
    });

    return ledger;
  } catch (error) {
    logger.error('Error al obtener libro mayor', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Balance General (Balance Sheet)
 */
interface BalanceSheetAccount {
  code: string;
  name: string;
  balance: number;
}

interface BalanceSheetSection {
  title: string;
  accounts: BalanceSheetAccount[];
  total: number;
}

interface BalanceSheetResult {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
}

/**
 * Obtiene el Balance General (Balance Sheet)
 * Muestra: Activo = Pasivo + Patrimonio Neto
 */
export async function getBalanceSheet(companyId: string, asOfDate: Date) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  const date = endOfDay(asOfDate);

  try {
    logger.info('Generando Balance General', { data: { companyId, date } });

    // Obtener todas las cuentas activas
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    // Calcular saldos hasta la fecha
    const balancesMap = await calculateAllAccountBalances(companyId, date);

    // Agrupar por tipo
    const assets: BalanceSheetAccount[] = [];
    const liabilities: BalanceSheetAccount[] = [];
    const equity: BalanceSheetAccount[] = [];

    for (const account of accounts) {
      const balance = balancesMap.get(account.id);
      if (!balance || balance.balance === 0) continue;

      const accountData: BalanceSheetAccount = {
        code: account.code,
        name: account.name,
        balance: balance.balance,
      };

      switch (account.type) {
        case AccountType.ASSET:
          assets.push(accountData);
          break;
        case AccountType.LIABILITY:
          liabilities.push(accountData);
          break;
        case AccountType.EQUITY:
          equity.push(accountData);
          break;
        // REVENUE y EXPENSE no van en el Balance General
      }
    }

    // Calcular totales
    const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
    const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    const result: BalanceSheetResult = {
      assets: {
        title: 'Activo',
        accounts: assets,
        total: totalAssets,
      },
      liabilities: {
        title: 'Pasivo',
        accounts: liabilities,
        total: totalLiabilities,
      },
      equity: {
        title: 'Patrimonio Neto',
        accounts: equity,
        total: totalEquity,
      },
      totalAssets,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      difference: totalAssets - totalLiabilitiesAndEquity,
    };

    logger.info('Balance General generado', {
      data: {
        totalAssets,
        totalLiabilitiesAndEquity,
        isBalanced: result.isBalanced,
      }
    });

    if (!result.isBalanced) {
      logger.warn('Balance General desbalanceado', {
        data: { difference: result.difference }
      });
    }

    return result;
  } catch (error) {
    logger.error('Error al generar Balance General', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Estado de Resultados (Income Statement)
 */
interface IncomeStatementAccount {
  code: string;
  name: string;
  amount: number;
}

interface IncomeStatementSection {
  title: string;
  accounts: IncomeStatementAccount[];
  total: number;
}

interface IncomeStatementResult {
  revenue: IncomeStatementSection;
  expenses: IncomeStatementSection;
  grossProfit: number;
  netIncome: number;
}

/**
 * Obtiene el Estado de Resultados (Income Statement)
 * Muestra: Ingresos - Gastos = Resultado del Período
 */
export async function getIncomeStatement(companyId: string, fromDate: Date, toDate: Date) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  try {
    logger.info('Generando Estado de Resultados', { data: { companyId, from, to } });

    // Obtener cuentas de ingresos y gastos
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        type: {
          in: [AccountType.REVENUE, AccountType.EXPENSE],
        },
      },
      orderBy: { code: 'asc' },
    });

    // Calcular movimientos en el período
    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId,
        status: JournalEntryStatus.POSTED,
        date: {
          gte: from,
          lte: to,
        },
      },
      include: {
        lines: true,
      },
    });

    // Calcular saldos por cuenta en el período
    const revenue: IncomeStatementAccount[] = [];
    const expenses: IncomeStatementAccount[] = [];

    for (const account of accounts) {
      const movements = entries.flatMap(entry => entry.lines)
        .filter(line => line.accountId === account.id);

      if (movements.length === 0) continue;

      const debitTotal = movements.reduce((sum, line) => sum + Number(line.debit), 0);
      const creditTotal = movements.reduce((sum, line) => sum + Number(line.credit), 0);

      // Para ingresos (REVENUE): crédito aumenta, débito disminuye
      // Para gastos (EXPENSE): débito aumenta, crédito disminuye
      const amount = account.type === AccountType.REVENUE
        ? creditTotal - debitTotal
        : debitTotal - creditTotal;

      if (amount === 0) continue;

      const accountData: IncomeStatementAccount = {
        code: account.code,
        name: account.name,
        amount,
      };

      if (account.type === AccountType.REVENUE) {
        revenue.push(accountData);
      } else {
        expenses.push(accountData);
      }
    }

    // Calcular totales
    const totalRevenue = revenue.reduce((sum, acc) => sum + acc.amount, 0);
    const totalExpenses = expenses.reduce((sum, acc) => sum + acc.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    const result: IncomeStatementResult = {
      revenue: {
        title: 'Ingresos',
        accounts: revenue,
        total: totalRevenue,
      },
      expenses: {
        title: 'Gastos',
        accounts: expenses,
        total: totalExpenses,
      },
      grossProfit: totalRevenue,
      netIncome,
    };

    logger.info('Estado de Resultados generado', {
      data: {
        totalRevenue,
        totalExpenses,
        netIncome,
      }
    });

    return result;
  } catch (error) {
    logger.error('Error al generar Estado de Resultados', { data: { error, companyId, userId } });
    throw error;
  }
}

// ==========================================
// REPORTES DE AUDITORÍA
// ==========================================

/**
 * Obtiene asientos sin respaldo documental
 * (no vinculados a ningún documento comercial ni reversiones)
 */
export async function getEntriesWithoutDocuments(
  companyId: string,
  fromDate: Date,
  toDate: Date
) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  try {
    logger.info('Obteniendo asientos sin respaldo', { data: { companyId, from, to } });

    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId,
        date: { gte: from, lte: to },
        originalEntryId: null,
        salesInvoices: { none: {} },
        purchaseInvoices: { none: {} },
        receipts: { none: {} },
        paymentOrders: { none: {} },
      },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        number: true,
        date: true,
        description: true,
        status: true,
        createdBy: true,
        createdAt: true,
        lines: {
          select: {
            debit: true,
            credit: true,
          },
        },
      },
    });

    return entries.map(entry => ({
      ...entry,
      totalDebit: entry.lines.reduce((sum, l) => sum + Number(l.debit), 0),
      totalCredit: entry.lines.reduce((sum, l) => sum + Number(l.credit), 0),
    }));
  } catch (error) {
    logger.error('Error al obtener asientos sin respaldo', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene el registro de reversiones (asientos anulados)
 */
export async function getReversalLog(
  companyId: string,
  fromDate: Date,
  toDate: Date
) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  try {
    logger.info('Obteniendo registro de reversiones', { data: { companyId, from, to } });

    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId,
        status: JournalEntryStatus.REVERSED,
        reversedAt: { gte: from, lte: to },
      },
      orderBy: { reversedAt: 'desc' },
      select: {
        id: true,
        number: true,
        date: true,
        description: true,
        reversedBy: true,
        reversedAt: true,
        reversalEntry: {
          select: {
            id: true,
            number: true,
            date: true,
          },
        },
        lines: {
          select: {
            debit: true,
            credit: true,
          },
        },
      },
    });

    return entries.map(entry => ({
      ...entry,
      totalAmount: entry.lines.reduce((sum, l) => sum + Number(l.debit), 0),
    }));
  } catch (error) {
    logger.error('Error al obtener registro de reversiones', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene la trazabilidad documento-asiento
 * Cruza documentos comerciales con sus asientos contables
 */
export async function getDocumentEntryTraceability(
  companyId: string,
  fromDate: Date,
  toDate: Date,
  documentType?: 'sales_invoice' | 'purchase_invoice' | 'receipt' | 'payment_order'
) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  try {
    logger.info('Obteniendo trazabilidad documento-asiento', { data: { companyId, from, to, documentType } });

    type TraceabilityItem = {
      documentType: string;
      documentId: string;
      fullNumber: string;
      date: Date;
      total: number;
      status: string;
      entryNumber: number | null;
      entryId: string | null;
      entryDate: Date | null;
      entryStatus: string | null;
      hasEntry: boolean;
    };

    const results: TraceabilityItem[] = [];

    if (!documentType || documentType === 'sales_invoice') {
      const invoices = await prisma.salesInvoice.findMany({
        where: {
          companyId,
          issueDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          fullNumber: true,
          issueDate: true,
          total: true,
          status: true,
          journalEntry: {
            select: { id: true, number: true, date: true, status: true },
          },
        },
        orderBy: { issueDate: 'asc' },
      });

      for (const inv of invoices) {
        results.push({
          documentType: 'Factura Venta',
          documentId: inv.id,
          fullNumber: inv.fullNumber,
          date: inv.issueDate,
          total: Number(inv.total),
          status: inv.status,
          entryNumber: inv.journalEntry?.number ?? null,
          entryId: inv.journalEntry?.id ?? null,
          entryDate: inv.journalEntry?.date ?? null,
          entryStatus: inv.journalEntry?.status ?? null,
          hasEntry: !!inv.journalEntry,
        });
      }
    }

    if (!documentType || documentType === 'purchase_invoice') {
      const invoices = await prisma.purchaseInvoice.findMany({
        where: {
          companyId,
          issueDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          fullNumber: true,
          issueDate: true,
          total: true,
          status: true,
          journalEntry: {
            select: { id: true, number: true, date: true, status: true },
          },
        },
        orderBy: { issueDate: 'asc' },
      });

      for (const inv of invoices) {
        results.push({
          documentType: 'Factura Compra',
          documentId: inv.id,
          fullNumber: inv.fullNumber,
          date: inv.issueDate,
          total: Number(inv.total),
          status: inv.status,
          entryNumber: inv.journalEntry?.number ?? null,
          entryId: inv.journalEntry?.id ?? null,
          entryDate: inv.journalEntry?.date ?? null,
          entryStatus: inv.journalEntry?.status ?? null,
          hasEntry: !!inv.journalEntry,
        });
      }
    }

    if (!documentType || documentType === 'receipt') {
      const recs = await prisma.receipt.findMany({
        where: {
          companyId,
          date: { gte: from, lte: to },
        },
        select: {
          id: true,
          fullNumber: true,
          date: true,
          totalAmount: true,
          status: true,
          journalEntry: {
            select: { id: true, number: true, date: true, status: true },
          },
        },
        orderBy: { date: 'asc' },
      });

      for (const rec of recs) {
        results.push({
          documentType: 'Recibo',
          documentId: rec.id,
          fullNumber: rec.fullNumber,
          date: rec.date,
          total: Number(rec.totalAmount),
          status: rec.status,
          entryNumber: rec.journalEntry?.number ?? null,
          entryId: rec.journalEntry?.id ?? null,
          entryDate: rec.journalEntry?.date ?? null,
          entryStatus: rec.journalEntry?.status ?? null,
          hasEntry: !!rec.journalEntry,
        });
      }
    }

    if (!documentType || documentType === 'payment_order') {
      const orders = await prisma.paymentOrder.findMany({
        where: {
          companyId,
          date: { gte: from, lte: to },
        },
        select: {
          id: true,
          fullNumber: true,
          date: true,
          totalAmount: true,
          status: true,
          journalEntry: {
            select: { id: true, number: true, date: true, status: true },
          },
        },
        orderBy: { date: 'asc' },
      });

      for (const order of orders) {
        results.push({
          documentType: 'Orden de Pago',
          documentId: order.id,
          fullNumber: order.fullNumber,
          date: order.date,
          total: Number(order.totalAmount),
          status: order.status,
          entryNumber: order.journalEntry?.number ?? null,
          entryId: order.journalEntry?.id ?? null,
          entryDate: order.journalEntry?.date ?? null,
          entryStatus: order.journalEntry?.status ?? null,
          hasEntry: !!order.journalEntry,
        });
      }
    }

    results.sort((a, b) => a.date.getTime() - b.date.getTime());

    return results;
  } catch (error) {
    logger.error('Error al obtener trazabilidad', { data: { error, companyId, userId } });
    throw error;
  }
}

// ============================================
// REPORTE: Registro de Bienes de Uso
// ============================================

export async function getFixedAssetsRegister(companyId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        companyId,
        depreciation: { isNot: null },
      },
      select: {
        id: true,
        internNumber: true,
        domain: true,
        year: true,
        isActive: true,
        type: { select: { name: true } },
        brand: { select: { name: true } },
        model: { select: { name: true } },
        depreciation: {
          select: {
            method: true,
            status: true,
            grossValue: true,
            salvageValue: true,
            currentBookValue: true,
            totalDepreciated: true,
            usefulLifeMonths: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { internNumber: 'asc' },
    });

    const items = vehicles.map((v) => {
      const dep = v.depreciation!;
      const grossValue = Number(dep.grossValue);
      const totalDepreciated = Number(dep.totalDepreciated);
      const currentBookValue = Number(dep.currentBookValue);
      const percentDepreciated = grossValue > 0 ? Math.round((totalDepreciated / grossValue) * 100) : 0;

      return {
        vehicleId: v.id,
        internNumber: v.internNumber,
        domain: v.domain,
        year: v.year,
        typeName: v.type?.name ?? null,
        brandName: v.brand?.name ?? null,
        modelName: v.model?.name ?? null,
        isActive: v.isActive,
        method: dep.method,
        status: dep.status,
        grossValue,
        salvageValue: Number(dep.salvageValue),
        totalDepreciated,
        currentBookValue,
        usefulLifeMonths: dep.usefulLifeMonths,
        startDate: dep.startDate,
        endDate: dep.endDate,
        percentDepreciated,
      };
    });

    const totals = {
      grossValue: items.reduce((sum, i) => sum + i.grossValue, 0),
      totalDepreciated: items.reduce((sum, i) => sum + i.totalDepreciated, 0),
      currentBookValue: items.reduce((sum, i) => sum + i.currentBookValue, 0),
    };

    return { items, totals, count: items.length };
  } catch (error) {
    logger.error('Error al obtener registro de bienes de uso', { data: { error, companyId, userId } });
    throw error;
  }
}

// ============================================
// REPORTE: Depreciaciones del Período
// ============================================

export async function getPeriodDepreciations(companyId: string, fromDate: Date, toDate: Date) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  try {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const entries = await prisma.depreciationScheduleEntry.findMany({
      where: {
        isPosted: true,
        postedDate: { gte: from, lte: to },
        depreciation: {
          companyId,
        },
      },
      select: {
        periodNumber: true,
        scheduledDate: true,
        amount: true,
        accumulatedAmount: true,
        postedDate: true,
        journalEntry: {
          select: { id: true, number: true },
        },
        depreciation: {
          select: {
            vehicle: {
              select: {
                id: true,
                internNumber: true,
                domain: true,
                type: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ postedDate: 'asc' }, { periodNumber: 'asc' }],
    });

    const items = entries.map((e) => ({
      vehicleId: e.depreciation.vehicle.id,
      vehicleLabel: e.depreciation.vehicle.internNumber || e.depreciation.vehicle.domain || '-',
      typeName: e.depreciation.vehicle.type?.name ?? null,
      periodNumber: e.periodNumber,
      scheduledDate: e.scheduledDate,
      amount: Number(e.amount),
      accumulatedAmount: Number(e.accumulatedAmount),
      postedDate: e.postedDate,
      entryNumber: e.journalEntry?.number ?? null,
      entryId: e.journalEntry?.id ?? null,
    }));

    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
    const vehicleCount = new Set(items.map((i) => i.vehicleId)).size;

    return { items, totalAmount: Math.round(totalAmount * 100) / 100, vehicleCount, count: items.length };
  } catch (error) {
    logger.error('Error al obtener depreciaciones del período', { data: { error, companyId, userId } });
    throw error;
  }
}

// ============================================
// REPORTE: Variación Presupuestaria
// ============================================

interface BudgetVarianceAccount {
  code: string;
  name: string;
  budgeted: number;
  executed: number;
  variance: number;
  variancePercent: number;
}

interface BudgetVarianceSection {
  accounts: BudgetVarianceAccount[];
  totalBudgeted: number;
  totalExecuted: number;
  totalVariance: number;
  totalVariancePercent: number;
}

interface BudgetVarianceResult {
  revenue: BudgetVarianceSection;
  expenses: BudgetVarianceSection;
  netBudgeted: number;
  netExecuted: number;
  netVariance: number;
  netVariancePercent: number;
  fiscalYear: number;
}

/**
 * Genera el reporte de variación presupuestaria.
 * Obtiene todos los presupuestos ACTIVE/CLOSED del año fiscal,
 * calcula el ejecutado acumulado de cada cuenta, y retorna
 * la comparación separada en REVENUE y EXPENSE.
 */
export async function getBudgetVarianceReport(
  companyId: string,
  fiscalYear: number
): Promise<BudgetVarianceResult> {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.reports', 'view', { redirect: true });

  try {
    logger.info('Generando reporte de variación presupuestaria', {
      data: { companyId, fiscalYear },
    });

    // Obtener settings para calcular rango fiscal
    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
      select: { fiscalYearStart: true, fiscalYearEnd: true },
    });

    if (!settings) {
      throw new Error('La empresa no tiene configuración contable');
    }

    // Calcular las fechas de inicio y fin del año fiscal
    const fiscalStartMonth = moment(settings.fiscalYearStart).month();
    const fiscalStartDay = moment(settings.fiscalYearStart).date();
    const fiscalYearStartDate = moment()
      .year(fiscalYear)
      .month(fiscalStartMonth)
      .date(fiscalStartDay)
      .startOf('day')
      .toDate();

    const fiscalYearEndDate = moment(fiscalYearStartDate)
      .add(1, 'year')
      .subtract(1, 'day')
      .endOf('day')
      .toDate();

    // Obtener todos los presupuestos ACTIVE o CLOSED del año fiscal
    const budgets = await prisma.budget.findMany({
      where: {
        companyId,
        fiscalYear,
        status: { in: [BudgetStatus.ACTIVE, BudgetStatus.CLOSED] },
      },
      select: {
        id: true,
        accountId: true,
        totalAmount: true,
        monthlyAmounts: true,
        account: {
          select: {
            code: true,
            name: true,
            type: true,
            nature: true,
          },
        },
      },
      orderBy: { account: { code: 'asc' } },
    });

    if (budgets.length === 0) {
      return {
        revenue: buildEmptySection(),
        expenses: buildEmptySection(),
        netBudgeted: 0,
        netExecuted: 0,
        netVariance: 0,
        netVariancePercent: 0,
        fiscalYear,
      };
    }

    // Obtener el ejecutado de todas las cuentas con presupuesto en una sola query
    const accountIds = budgets.map((b) => b.accountId);

    const executionResults = await prisma.$queryRaw<
      {
        account_id: string;
        total_debit: Prisma.Decimal;
        total_credit: Prisma.Decimal;
      }[]
    >`
      SELECT
        jel.account_id,
        COALESCE(SUM(jel.debit), 0) AS total_debit,
        COALESCE(SUM(jel.credit), 0) AS total_credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.id
      WHERE jel.account_id = ANY(${accountIds}::uuid[])
        AND je.company_id = ${companyId}::uuid
        AND je.status = 'POSTED'
        AND je.date >= ${fiscalYearStartDate}
        AND je.date <= ${fiscalYearEndDate}
      GROUP BY jel.account_id
    `;

    // Crear mapa de ejecutado por cuenta
    const executionMap = new Map<string, { debit: number; credit: number }>();
    for (const row of executionResults) {
      executionMap.set(row.account_id, {
        debit: Number(row.total_debit),
        credit: Number(row.total_credit),
      });
    }

    // Construir datos por sección
    const revenueAccounts: BudgetVarianceAccount[] = [];
    const expenseAccounts: BudgetVarianceAccount[] = [];

    for (const budget of budgets) {
      const budgeted = Number(budget.totalAmount);
      const execution = executionMap.get(budget.accountId) || {
        debit: 0,
        credit: 0,
      };

      // Calcular ejecutado según naturaleza de la cuenta
      // EXPENSE (DEBIT nature): ejecutado = debit - credit
      // REVENUE (CREDIT nature): ejecutado = credit - debit
      const executed =
        budget.account.nature === AccountNature.DEBIT
          ? execution.debit - execution.credit
          : execution.credit - execution.debit;

      const variance = budgeted - executed;
      const variancePercent =
        budgeted === 0
          ? executed === 0
            ? 0
            : -100
          : ((budgeted - executed) / budgeted) * 100;

      const accountData: BudgetVarianceAccount = {
        code: budget.account.code,
        name: budget.account.name,
        budgeted,
        executed,
        variance,
        variancePercent,
      };

      if (budget.account.type === AccountType.REVENUE) {
        revenueAccounts.push(accountData);
      } else {
        expenseAccounts.push(accountData);
      }
    }

    // Calcular totales por sección
    const revenue = buildSection(revenueAccounts);
    const expenses = buildSection(expenseAccounts);

    // Resultado neto
    const netBudgeted = revenue.totalBudgeted - expenses.totalBudgeted;
    const netExecuted = revenue.totalExecuted - expenses.totalExecuted;
    const netVariance = netBudgeted - netExecuted;
    const netVariancePercent =
      netBudgeted === 0
        ? netExecuted === 0
          ? 0
          : -100
        : ((netBudgeted - netExecuted) / Math.abs(netBudgeted)) * 100;

    logger.info('Reporte de variación presupuestaria generado', {
      data: {
        fiscalYear,
        revenueAccounts: revenueAccounts.length,
        expenseAccounts: expenseAccounts.length,
        netBudgeted,
        netExecuted,
      },
    });

    return {
      revenue,
      expenses,
      netBudgeted,
      netExecuted,
      netVariance,
      netVariancePercent,
      fiscalYear,
    };
  } catch (error) {
    logger.error('Error al generar reporte de variación presupuestaria', {
      data: { error, companyId, fiscalYear, userId },
    });
    throw error;
  }
}

function buildSection(accounts: BudgetVarianceAccount[]): BudgetVarianceSection {
  const totalBudgeted = accounts.reduce((sum, a) => sum + a.budgeted, 0);
  const totalExecuted = accounts.reduce((sum, a) => sum + a.executed, 0);
  const totalVariance = totalBudgeted - totalExecuted;
  const totalVariancePercent =
    totalBudgeted === 0
      ? totalExecuted === 0
        ? 0
        : -100
      : ((totalBudgeted - totalExecuted) / totalBudgeted) * 100;

  return {
    accounts,
    totalBudgeted,
    totalExecuted,
    totalVariance,
    totalVariancePercent,
  };
}

function buildEmptySection(): BudgetVarianceSection {
  return {
    accounts: [],
    totalBudgeted: 0,
    totalExecuted: 0,
    totalVariance: 0,
    totalVariancePercent: 0,
  };
}
