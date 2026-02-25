import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { WarehouseForm } from './components/_WarehouseForm';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

export function CreateWarehouse() {
  return (
    <PermissionGuard module="commercial.warehouses" action="create" redirect>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo Almacén</h1>
        <p className="text-muted-foreground">
          Crea un nuevo almacén o depósito para gestionar inventario
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Almacén</CardTitle>
          <CardDescription>
            Completa los datos del almacén. Los campos marcados son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarehouseForm />
        </CardContent>
      </Card>
    </div>
    </PermissionGuard>
  );
}
