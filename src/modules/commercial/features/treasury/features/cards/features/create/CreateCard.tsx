import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _CreateCardForm } from './components/_CreateCardForm';

export async function CreateCard() {
  return (
    <PermissionGuard module="commercial.treasury.cards" action="create" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nueva Tarjeta</h1>
          <p className="text-sm text-muted-foreground">
            Completa la información de la nueva tarjeta
          </p>
        </div>

        <_CreateCardForm />
      </div>
    </PermissionGuard>
  );
}
