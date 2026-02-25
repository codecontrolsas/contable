import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/formatters';
import { getProjectionsPaginated, getProjectionsTotals } from '../actions.server';
import { _ProjectionsTable } from './components/_ProjectionsTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function CashflowProjectionsList({ searchParams = {} }: Props) {
  const [totals, paginatedResult] = await Promise.all([
    getProjectionsTotals(),
    getProjectionsPaginated(searchParams),
  ]);

  const isPositiveBalance = totals.netBalance >= 0;

  return (
    <PermissionGuard module="commercial.treasury.projections" action="view" redirect>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Proyecciones de Cashflow</h1>
        <p className="text-muted-foreground">Gestión de proyecciones de flujo de caja</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos Proyectados</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">Suma de proyecciones de ingresos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Egresos Proyectados</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totals.totalExpense)}
            </div>
            <p className="text-xs text-muted-foreground">Suma de proyecciones de egresos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Neto</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${isPositiveBalance ? 'text-green-600' : 'text-destructive'}`}
            >
              {formatCurrency(totals.netBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Ingresos - Egresos proyectados</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <_ProjectionsTable
        data={paginatedResult.data}
        totalRows={paginatedResult.totalRows}
        searchParams={searchParams}
      />
    </div>
    </PermissionGuard>
  );
}
