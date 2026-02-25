import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { InvoiceForm } from './components/_InvoiceForm';
import {
  getActiveCustomers,
  getActivePointsOfSale,
  getActiveProducts,
} from './helpers.server';

export async function CreateInvoice() {
  const [customers, pointsOfSale, products] = await Promise.all([
    getActiveCustomers(),
    getActivePointsOfSale(),
    getActiveProducts(),
  ]);

  return (
    <PermissionGuard module="commercial.invoices" action="create" redirect>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nueva Factura de Venta</h2>
          <p className="text-muted-foreground">
            Completa los datos para emitir una nueva factura
          </p>
        </div>

        <InvoiceForm customers={customers} pointsOfSale={pointsOfSale} products={products} />
      </div>
    </PermissionGuard>
  );
}
