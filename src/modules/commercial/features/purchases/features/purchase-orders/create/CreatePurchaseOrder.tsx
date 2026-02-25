import { getSuppliersForSelect, getProductsForSelect } from '../list/actions.server';
import { _PurchaseOrderForm } from './components/_PurchaseOrderForm';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

export async function CreatePurchaseOrder() {
  const [suppliers, products] = await Promise.all([
    getSuppliersForSelect(),
    getProductsForSelect(),
  ]);

  return (
    <PermissionGuard module="commercial.purchase-orders" action="create" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nueva Orden de Compra</h1>
          <p className="text-muted-foreground">
            Crea una nueva orden de compra para un proveedor
          </p>
        </div>

        <_PurchaseOrderForm suppliers={suppliers} products={products} />
      </div>
    </PermissionGuard>
  );
}
