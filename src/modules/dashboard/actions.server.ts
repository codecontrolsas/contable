'use server';

import { auth } from '@clerk/nextjs/server';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import moment from 'moment';

// Parsear período "YYYY-MM" o usar mes actual
function parsePeriod(period?: string) {
  const m = period ? moment(period, 'YYYY-MM', true) : moment();
  if (!m.isValid()) return moment();
  return m;
}

// ============================================
// KPIs PRINCIPALES
// ============================================

export async function getDashboardKPIs(period?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('dashboard', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const ref = parsePeriod(period);
    const startOfMonth = ref.clone().startOf('month').toDate();
    const endOfMonth = ref.clone().endOf('month').toDate();
    const isCurrentMonth = ref.isSame(moment(), 'month');

    // Para pendientes y alertas: si es mes actual, usar "hoy"; si es histórico, usar fin de ese mes
    const cutoffDate = isCurrentMonth ? new Date() : endOfMonth;

    const [
      salesInvoices,
      purchaseInvoices,
      monthExpenses,
      pendingSalesInvoices,
      pendingPurchaseInvoices,
      pendingExpenses,
      criticalStockProducts,
      bankAccounts,
    ] = await Promise.all([
      // Ventas del mes seleccionado (excluyendo NC)
      prisma.salesInvoice.findMany({
        where: {
          companyId,
          issueDate: { gte: startOfMonth, lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: { total: true },
      }),

      // Compras del mes seleccionado (excluyendo NC)
      prisma.purchaseInvoice.findMany({
        where: {
          companyId,
          issueDate: { gte: startOfMonth, lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: { total: true },
      }),

      // Gastos del mes seleccionado
      prisma.expense.findMany({
        where: {
          companyId,
          date: { gte: startOfMonth, lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
        },
        select: { amount: true },
      }),

      // Facturas de venta pendientes de cobro emitidas hasta fin del período (no NC)
      prisma.salesInvoice.findMany({
        where: {
          companyId,
          issueDate: { lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: { total: true },
      }),

      // Facturas de compra pendientes de pago emitidas hasta fin del período (no NC)
      prisma.purchaseInvoice.findMany({
        where: {
          companyId,
          issueDate: { lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: { total: true },
      }),

      // Gastos pendientes de pago emitidos hasta fin del período
      prisma.expense.findMany({
        where: {
          companyId,
          date: { lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PARTIAL_PAID'] },
        },
        select: { amount: true },
      }),

      // Productos con stock crítico (siempre actual)
      prisma.product.findMany({
        where: {
          companyId,
          trackStock: true,
          minStock: { gt: 0 },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          minStock: true,
          warehouseStocks: {
            select: { quantity: true },
          },
        },
      }),

      // Saldo bancario (siempre actual)
      prisma.bankAccount.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { balance: true },
      }),
    ]);

    // Calcular KPIs
    const salesTotal = salesInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const purchasesTotal = purchaseInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const expensesTotal = monthExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    const receivablesTotal = pendingSalesInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const payablesInvoiceTotal = pendingPurchaseInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const payablesExpenseTotal = pendingExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Stock crítico: filtrar en JS los que tienen stock total < minStock
    const criticalCount = criticalStockProducts.filter((product) => {
      const totalStock = product.warehouseStocks.reduce((sum, ws) => sum + Number(ws.quantity), 0);
      return totalStock < Number(product.minStock);
    }).length;

    const totalBankBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    return {
      salesThisMonth: { total: salesTotal, count: salesInvoices.length },
      purchasesThisMonth: { total: purchasesTotal, count: purchaseInvoices.length },
      expensesThisMonth: { total: expensesTotal, count: monthExpenses.length },
      pendingReceivables: { total: receivablesTotal, count: pendingSalesInvoices.length },
      pendingPayables: {
        total: payablesInvoiceTotal + payablesExpenseTotal,
        count: pendingPurchaseInvoices.length + pendingExpenses.length,
      },
      criticalStockCount: criticalCount,
      bankBalance: totalBankBalance,
    };
  } catch (error) {
    logger.error('Error al obtener KPIs del dashboard', { data: { error, companyId } });
    throw new Error('Error al obtener datos del dashboard');
  }
}

// ============================================
// TENDENCIA DE VENTAS (6 meses)
// ============================================

export async function getSalesTrend(period?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('dashboard', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const ref = parsePeriod(period);
    const sixMonthsAgo = ref.clone().subtract(5, 'months').startOf('month').toDate();
    const endOfRef = ref.clone().endOf('month').toDate();

    const invoices = await prisma.salesInvoice.findMany({
      where: {
        companyId,
        issueDate: { gte: sixMonthsAgo, lte: endOfRef },
        status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
        voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
      },
      select: { issueDate: true, total: true },
    });

    // Generar los 6 meses terminando en el mes de referencia
    const months: Array<{ month: string; monthKey: string; total: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const m = ref.clone().subtract(i, 'months');
      months.push({
        month: m.format('MMM YY'),
        monthKey: m.format('YYYY-MM'),
        total: 0,
      });
    }

    // Agrupar facturas por mes
    for (const inv of invoices) {
      const key = moment(inv.issueDate).format('YYYY-MM');
      const monthEntry = months.find((m) => m.monthKey === key);
      if (monthEntry) {
        monthEntry.total += Number(inv.total);
      }
    }

    return months.map(({ month, total }) => ({ month, total }));
  } catch (error) {
    logger.error('Error al obtener tendencia de ventas', { data: { error, companyId } });
    throw new Error('Error al obtener tendencia de ventas');
  }
}

// ============================================
// TENDENCIA DE COMPRAS (6 meses)
// ============================================

export async function getPurchasesTrend(period?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('dashboard', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const ref = parsePeriod(period);
    const sixMonthsAgo = ref.clone().subtract(5, 'months').startOf('month').toDate();
    const endOfRef = ref.clone().endOf('month').toDate();

    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        issueDate: { gte: sixMonthsAgo, lte: endOfRef },
        status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
        voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
      },
      select: { issueDate: true, total: true },
    });

    const months: Array<{ month: string; monthKey: string; total: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const m = ref.clone().subtract(i, 'months');
      months.push({
        month: m.format('MMM YY'),
        monthKey: m.format('YYYY-MM'),
        total: 0,
      });
    }

    for (const inv of invoices) {
      const key = moment(inv.issueDate).format('YYYY-MM');
      const monthEntry = months.find((m) => m.monthKey === key);
      if (monthEntry) {
        monthEntry.total += Number(inv.total);
      }
    }

    return months.map(({ month, total }) => ({ month, total }));
  } catch (error) {
    logger.error('Error al obtener tendencia de compras', { data: { error, companyId } });
    throw new Error('Error al obtener tendencia de compras');
  }
}

// ============================================
// RENTABILIDAD MENSUAL (6 meses)
// ============================================

export async function getProfitabilityTrend(period?: string, excludeCategoryIds?: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('dashboard', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const ref = parsePeriod(period);
    const sixMonthsAgo = ref.clone().subtract(5, 'months').startOf('month').toDate();
    const endOfRef = ref.clone().endOf('month').toDate();

    const [salesInvoices, purchaseInvoices, expenses] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: {
          companyId,
          issueDate: { gte: sixMonthsAgo, lte: endOfRef },
          status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: { issueDate: true, total: true },
      }),
      prisma.purchaseInvoice.findMany({
        where: {
          companyId,
          issueDate: { gte: sixMonthsAgo, lte: endOfRef },
          status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: { issueDate: true, total: true },
      }),
      prisma.expense.findMany({
        where: {
          companyId,
          date: { gte: sixMonthsAgo, lte: endOfRef },
          status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
          ...(excludeCategoryIds && excludeCategoryIds.length > 0
            ? { categoryId: { notIn: excludeCategoryIds } }
            : {}),
        },
        select: { date: true, amount: true },
      }),
    ]);

    // Generar los 6 meses
    const months: Array<{
      month: string;
      monthKey: string;
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const m = ref.clone().subtract(i, 'months');
      months.push({
        month: m.format('MMM YY'),
        monthKey: m.format('YYYY-MM'),
        sales: 0,
        purchases: 0,
        expenses: 0,
        profit: 0,
      });
    }

    for (const inv of salesInvoices) {
      const key = moment(inv.issueDate).format('YYYY-MM');
      const entry = months.find((m) => m.monthKey === key);
      if (entry) entry.sales += Number(inv.total);
    }

    for (const inv of purchaseInvoices) {
      const key = moment(inv.issueDate).format('YYYY-MM');
      const entry = months.find((m) => m.monthKey === key);
      if (entry) entry.purchases += Number(inv.total);
    }

    for (const exp of expenses) {
      const key = moment(exp.date).format('YYYY-MM');
      const entry = months.find((m) => m.monthKey === key);
      if (entry) entry.expenses += Number(exp.amount);
    }

    // Calcular rentabilidad
    for (const m of months) {
      m.profit = m.sales - m.purchases - m.expenses;
    }

    return months.map(({ month, sales, purchases, expenses, profit }) => ({
      month,
      sales,
      purchases,
      expenses,
      profit,
    }));
  } catch (error) {
    logger.error('Error al obtener tendencia de rentabilidad', { data: { error, companyId } });
    throw new Error('Error al obtener tendencia de rentabilidad');
  }
}

// ============================================
// CATEGORÍAS DE GASTOS (para filtro)
// ============================================

export async function getExpenseCategories() {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('dashboard', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return categories;
  } catch (error) {
    logger.error('Error al obtener categorías de gastos', { data: { error, companyId } });
    throw new Error('Error al obtener categorías de gastos');
  }
}

// ============================================
// PRODUCTOS CON STOCK CRÍTICO
// ============================================

export async function getCriticalStockProducts() {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('dashboard', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const products = await prisma.product.findMany({
      where: {
        companyId,
        trackStock: true,
        minStock: { gt: 0 },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        code: true,
        unitOfMeasure: true,
        minStock: true,
        warehouseStocks: {
          select: { quantity: true },
        },
      },
    });

    // Filtrar y mapear
    const criticalProducts = products
      .map((product) => {
        const totalStock = product.warehouseStocks.reduce((sum, ws) => sum + Number(ws.quantity), 0);
        const minStock = Number(product.minStock);
        return {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          totalStock,
          minStock,
          unitOfMeasure: product.unitOfMeasure,
          stockPercentage: minStock > 0 ? Math.round((totalStock / minStock) * 100) : 0,
        };
      })
      .filter((p) => p.totalStock < p.minStock)
      .sort((a, b) => a.stockPercentage - b.stockPercentage)
      .slice(0, 10);

    return criticalProducts;
  } catch (error) {
    logger.error('Error al obtener productos con stock crítico', { data: { error, companyId } });
    throw new Error('Error al obtener productos con stock crítico');
  }
}

// ============================================
// ALERTAS RECIENTES
// ============================================

export async function getRecentAlerts(period?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('dashboard', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const ref = parsePeriod(period);
    const endOfMonth = ref.clone().endOf('month').toDate();
    const isCurrentMonth = ref.isSame(moment(), 'month');
    // Para mes actual usar hoy, para histórico usar fin de ese mes
    const cutoffDate = isCurrentMonth ? new Date() : endOfMonth;

    const [overdueReceivables, overduePayables, overdueExpenses] = await Promise.all([
      // Facturas de venta vencidas al corte
      prisma.salesInvoice.findMany({
        where: {
          companyId,
          dueDate: { lt: cutoffDate },
          issueDate: { lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: {
          fullNumber: true,
          total: true,
          dueDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),

      // Facturas de compra vencidas al corte
      prisma.purchaseInvoice.findMany({
        where: {
          companyId,
          dueDate: { lt: cutoffDate },
          issueDate: { lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PARTIAL_PAID'] },
          voucherType: { notIn: ['NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C'] },
        },
        select: {
          fullNumber: true,
          total: true,
          dueDate: true,
          supplier: { select: { businessName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),

      // Gastos vencidos al corte
      prisma.expense.findMany({
        where: {
          companyId,
          dueDate: { lt: cutoffDate },
          date: { lte: endOfMonth },
          status: { in: ['CONFIRMED', 'PARTIAL_PAID'] },
        },
        select: {
          fullNumber: true,
          amount: true,
          dueDate: true,
          description: true,
        },
        orderBy: { dueDate: 'asc' },
        take: 3,
      }),
    ]);

    type Alert = {
      type: 'overdue_receivable' | 'overdue_payable' | 'overdue_expense';
      title: string;
      description: string;
      date: Date | null;
      amount: number;
    };

    const alerts: Alert[] = [];

    for (const inv of overdueReceivables) {
      alerts.push({
        type: 'overdue_receivable',
        title: `Cobro vencido - ${inv.fullNumber}`,
        description: inv.customer.name,
        date: inv.dueDate,
        amount: Number(inv.total),
      });
    }

    for (const inv of overduePayables) {
      alerts.push({
        type: 'overdue_payable',
        title: `Pago vencido - ${inv.fullNumber}`,
        description: inv.supplier.businessName,
        date: inv.dueDate,
        amount: Number(inv.total),
      });
    }

    for (const exp of overdueExpenses) {
      // Expense.dueDate usa @db.Date (medianoche UTC) → normalizar a mediodía para evitar desfase de timezone
      const normalizedDate = exp.dueDate
        ? moment.utc(exp.dueDate).startOf('day').add(12, 'hours').toDate()
        : null;
      alerts.push({
        type: 'overdue_expense',
        title: `Gasto vencido - ${exp.fullNumber}`,
        description: exp.description,
        date: normalizedDate,
        amount: Number(exp.amount),
      });
    }

    // Ordenar por fecha (más vencida primero)
    alerts.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.getTime() - b.date.getTime();
    });

    return alerts.slice(0, 8);
  } catch (error) {
    logger.error('Error al obtener alertas', { data: { error, companyId } });
    throw new Error('Error al obtener alertas');
  }
}
