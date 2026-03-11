import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _QuickMonthFilter } from '@/shared/components/common/_QuickMonthFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { getReceipts, getReceiptsPaginated } from '../actions.server';
import { _ReceiptsTable } from './components/_ReceiptsTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function ReceiptsList({ searchParams = {} }: Props) {
  const [allReceipts, paginatedResult] = await Promise.all([
    getReceipts(),
    getReceiptsPaginated(searchParams),
  ]);

  // KPIs desde todos los recibos
  const totalAmount = allReceipts.reduce((acc, r) => acc + r.totalAmount, 0);
  const confirmedCount = allReceipts.filter((r) => r.status === 'CONFIRMED').length;
  const draftCount = allReceipts.filter((r) => r.status === 'DRAFT').length;

  return (
    <PermissionGuard module="commercial.treasury.receipts" action="view" redirect>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recibos de Cobro</h1>
        <p className="text-muted-foreground">Gestión de recibos de cobro y cobranzas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total de recibos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recibos Confirmados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedCount}</div>
            <p className="text-xs text-muted-foreground">De {allReceipts.length} totales</p>
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

      <_QuickMonthFilter />

      {/* Table */}
      <_ReceiptsTable
        data={paginatedResult.data}
        totalRows={paginatedResult.total}
        searchParams={searchParams}
      />
    </div>
    </PermissionGuard>
  );
}
