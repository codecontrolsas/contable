import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getWarehouseById, updateWarehouse } from '../list/actions.server';
import { WarehouseForm } from '../create/components/_WarehouseForm';
import type { UpdateWarehouseFormData } from '../../shared/validators';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

interface EditWarehouseProps {
  warehouseId: string;
}

export async function EditWarehouse({ warehouseId }: EditWarehouseProps) {
  const warehouse = await getWarehouseById(warehouseId);

  const defaultValues: UpdateWarehouseFormData = {
    code: warehouse.code,
    name: warehouse.name,
    type: warehouse.type,
    address: warehouse.address || undefined,
    city: warehouse.city || undefined,
    state: warehouse.state || undefined,
    isActive: warehouse.isActive,
  };

  const handleSubmit = async (data: UpdateWarehouseFormData) => {
    'use server';
    await updateWarehouse(warehouseId, data);
  };

  return (
    <PermissionGuard module="commercial.warehouses" action="update" redirect>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editar Almacén</h1>
        <p className="text-muted-foreground">
          Modifica los datos del almacén {warehouse.code}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Almacén</CardTitle>
          <CardDescription>
            Actualiza los datos del almacén. El código no puede modificarse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarehouseForm
            defaultValues={defaultValues}
            warehouseId={warehouseId}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
    </PermissionGuard>
  );
}
