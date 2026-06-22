import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _CreatePartnerForm } from './components/_CreatePartnerForm';

export async function CreatePartner() {
  return (
    <PermissionGuard module="commercial.treasury.partners" action="create" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nuevo Socio</h1>
          <p className="text-sm text-muted-foreground">
            Completa la información del nuevo socio
          </p>
        </div>

        <_CreatePartnerForm />
      </div>
    </PermissionGuard>
  );
}
