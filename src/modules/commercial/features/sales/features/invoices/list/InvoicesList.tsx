import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getInvoicesPaginated, getInvoiceFacetCounts } from './actions.server';
import { _InvoicesTable } from './components/_InvoicesTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function InvoicesList({ searchParams = {} }: Props) {
  const [paginatedResult, facetCounts] = await Promise.all([
    getInvoicesPaginated(searchParams),
    getInvoiceFacetCounts(),
  ]);

  return (
    <PermissionGuard module="commercial.invoices" action="view" redirect>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Facturas de Venta</h2>
            <p className="text-muted-foreground">
              Gestiona las facturas emitidas a tus clientes
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/commercial/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Factura
            </Link>
          </Button>
        </div>

        <_InvoicesTable
          data={paginatedResult.data}
          totalRows={paginatedResult.total}
          searchParams={searchParams}
          facetCounts={facetCounts}
        />
      </div>
    </PermissionGuard>
  );
}
