import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getPurchaseInvoicesPaginated, getPurchaseInvoiceFacetCounts } from './actions.server';
import { _PurchaseInvoicesTable } from './components/_PurchaseInvoicesTable';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _QuickMonthFilter } from '@/shared/components/common/_QuickMonthFilter';

interface Props {
  searchParams: DataTableSearchParams;
}

export async function PurchaseInvoicesList({ searchParams }: Props) {
  const [initialData, facetCounts] = await Promise.all([
    getPurchaseInvoicesPaginated(searchParams),
    getPurchaseInvoiceFacetCounts(),
  ]);

  return (
    <PermissionGuard module="commercial.purchases" action="view" redirect>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facturas de Compra</h1>
            <p className="text-muted-foreground">
              Registra y gestiona las facturas de tus proveedores
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/commercial/purchases/new">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Factura
            </Link>
          </Button>
        </div>

        <_QuickMonthFilter filterKey="issueDate" />

        <_PurchaseInvoicesTable data={initialData.data} totalRows={initialData.total} searchParams={searchParams} facetCounts={facetCounts} />
      </div>
    </PermissionGuard>
  );
}
