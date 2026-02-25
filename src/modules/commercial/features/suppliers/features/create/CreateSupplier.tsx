import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _CreateSupplierForm } from './components/_CreateSupplierForm';

export async function CreateSupplier() {
  return (
    <PermissionGuard module="commercial.suppliers" action="create" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nuevo Proveedor</h1>
          <p className="text-sm text-muted-foreground">
            Completa la información del nuevo proveedor
          </p>
        </div>

        <_CreateSupplierForm />
      </div>
    </PermissionGuard>
  );
}
