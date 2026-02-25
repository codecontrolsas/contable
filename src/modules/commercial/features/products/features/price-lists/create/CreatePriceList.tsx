import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _CreatePriceListForm } from './components/_CreatePriceListForm';

export async function CreatePriceList() {
  return (
    <PermissionGuard module="commercial.price-lists" action="create" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nueva Lista de Precios</h1>
          <p className="text-sm text-muted-foreground">
            Crea una nueva lista de precios para asignar a tus clientes
          </p>
        </div>

        <_CreatePriceListForm />
      </div>
    </PermissionGuard>
  );
}
