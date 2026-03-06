import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { getPaymentOrders, getPaymentOrdersPaginated, getPaymentOrderFacetCounts } from '../actions.server';
import { _PaymentOrdersTable } from './components/_PaymentOrdersTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function PaymentOrdersList({ searchParams = {} }: Props) {
  const [allOrders, paginatedResult, facetCounts] = await Promise.all([
    getPaymentOrders(),
    getPaymentOrdersPaginated(searchParams),
    getPaymentOrderFacetCounts(),
  ]);

  // KPIs desde todos los registros
  const totalAmount = allOrders.reduce((acc, po) => acc + po.totalAmount, 0);
  const confirmedCount = allOrders.filter((po) => po.status === 'CONFIRMED').length;
  const draftCount = allOrders.filter((po) => po.status === 'DRAFT').length;

  return (
    <PermissionGuard module="commercial.treasury.payment-orders" action="view" redirect>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Órdenes de Pago</h1>
        <p className="text-muted-foreground">Gestión de órdenes de pago a proveedores</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total de órdenes confirmadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Confirmadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedCount}</div>
            <p className="text-xs text-muted-foreground">De {allOrders.length} totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Borradores</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount}</div>
            <p className="text-xs text-muted-foreground">Pendientes de confirmar</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <_PaymentOrdersTable
        data={paginatedResult.data}
        totalRows={paginatedResult.total}
        searchParams={searchParams}
        facetCounts={facetCounts}
      />
    </div>
    </PermissionGuard>
  );
}
