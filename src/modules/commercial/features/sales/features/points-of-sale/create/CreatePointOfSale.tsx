import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { PointOfSaleForm } from './components/_PointOfSaleForm';

export function CreatePointOfSale() {
  return (
    <PermissionGuard module="commercial.points-of-sale" action="create" redirect>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nuevo Punto de Venta</h2>
          <p className="text-muted-foreground">
            Crea un nuevo punto de venta para la facturación
          </p>
        </div>

        <PointOfSaleForm />
      </div>
    </PermissionGuard>
  );
}
