import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getPurchaseOrdersPaginated } from './actions.server';
import { _PurchaseOrdersTable } from './components/_PurchaseOrdersTable';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

interface Props {
  searchParams: DataTableSearchParams;
}

export async function PurchaseOrdersList({ searchParams }: Props) {
  const initialData = await getPurchaseOrdersPaginated(searchParams);

  return (
    <PermissionGuard module="commercial.purchase-orders" action="view" redirect>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Órdenes de Compra</h1>
            <p className="text-muted-foreground">
              Gestiona las órdenes de compra a proveedores
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/commercial/purchase-orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Orden
            </Link>
          </Button>
        </div>

        <_PurchaseOrdersTable data={initialData.data} totalRows={initialData.total} searchParams={searchParams} />
      </div>
    </PermissionGuard>
  );
}
