import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getSupplierById } from '../list/actions.server';
import { _EditSupplierForm } from './components/_EditSupplierForm';
import { notFound } from 'next/navigation';

interface EditSupplierProps {
  supplierId: string;
}

export async function EditSupplier({ supplierId }: EditSupplierProps) {
  const supplier = await getSupplierById(supplierId);

  if (!supplier) {
    notFound();
  }

  return (
    <PermissionGuard module="commercial.suppliers" action="update" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editar Proveedor</h1>
          <p className="text-sm text-muted-foreground">
            Modifica la información del proveedor: {supplier.businessName}
          </p>
        </div>

        <_EditSupplierForm supplier={supplier} />
      </div>
    </PermissionGuard>
  );
}
