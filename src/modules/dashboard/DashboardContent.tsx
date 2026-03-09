import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  TrendingUp,
  ShoppingCart,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Landmark,
} from 'lucide-react';
import { formatCurrency } from '@/shared/utils/formatters';
import {
  getDashboardKPIs,
  getSalesTrend,
  getPurchasesTrend,
  getProfitabilityTrend,
  getExpenseCategories,
  getCriticalStockProducts,
  getRecentAlerts,
} from './actions.server';
import { _SalesTrendChart } from './components/_SalesTrendChart';
import { _PurchasesTrendChart } from './components/_PurchasesTrendChart';
import { _CriticalStockList } from './components/_CriticalStockList';
import { _AlertsList } from './components/_AlertsList';
import { _ProfitabilityChart } from './components/_ProfitabilityChart';
import { _PeriodSelector } from './components/_PeriodSelector';
import moment from 'moment';

interface DashboardContentProps {
  period?: string; // "YYYY-MM" o undefined = mes actual
}

export async function DashboardContent({ period }: DashboardContentProps) {
  async function Content() {
    const validPeriod = period && moment(period, 'YYYY-MM', true).isValid() ? period : undefined;
    const displayPeriod = validPeriod || moment().format('YYYY-MM');
    const isCurrentMonth = !validPeriod || moment(validPeriod, 'YYYY-MM').isSame(moment(), 'month');

    const [kpis, salesTrend, purchasesTrend, profitabilityTrend, expenseCategories, criticalStock, alerts] = await Promise.all([
      getDashboardKPIs(validPeriod),
      getSalesTrend(validPeriod),
      getPurchasesTrend(validPeriod),
      getProfitabilityTrend(validPeriod),
      getExpenseCategories(),
      getCriticalStockProducts(),
      getRecentAlerts(validPeriod),
    ]);

    const periodLabel = moment(displayPeriod, 'YYYY-MM').format('MMMM YYYY');

    return (
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {isCurrentMonth ? 'Resumen general de tu empresa' : `Datos de ${periodLabel}`}
          </p>
        </div>
        <_PeriodSelector currentPeriod={displayPeriod} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isCurrentMonth ? 'Ventas del Mes' : 'Ventas'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.salesThisMonth.total)}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.salesThisMonth.count} factura{kpis.salesThisMonth.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isCurrentMonth ? 'Compras del Mes' : 'Compras'}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.purchasesThisMonth.total)}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.purchasesThisMonth.count} factura{kpis.purchasesThisMonth.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isCurrentMonth ? 'Gastos del Mes' : 'Gastos'}
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.expensesThisMonth.total)}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.expensesThisMonth.count} gasto{kpis.expensesThisMonth.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de Cobro</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(kpis.pendingReceivables.total)}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis.pendingReceivables.count} documento
              {kpis.pendingReceivables.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de Pago</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(kpis.pendingPayables.total)}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis.pendingPayables.count} documento{kpis.pendingPayables.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${kpis.criticalStockCount > 0 ? 'text-yellow-600' : ''}`}
            >
              {kpis.criticalStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              producto{kpis.criticalStockCount !== 1 ? 's' : ''} bajo mínimo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Bancario</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${kpis.bankBalance < 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {formatCurrency(kpis.bankBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Cuentas activas</p>
          </CardContent>
        </Card>
      </div>

      {/* Profitability Chart */}
      <_ProfitabilityChart data={profitabilityTrend} categories={expenseCategories} period={validPeriod} />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <_SalesTrendChart data={salesTrend} />
        <_PurchasesTrendChart data={purchasesTrend} />
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <_CriticalStockList products={criticalStock} />
        <_AlertsList alerts={alerts} />
      </div>
    </div>
    );
  }

  return (
    <PermissionGuard module="dashboard" action="view" redirect>
      <Content />
    </PermissionGuard>
  );
}
