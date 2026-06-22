import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { notFound } from 'next/navigation';
import { getPartnerById } from '../list/actions.server';
import { _EditPartnerForm } from './components/_EditPartnerForm';

interface EditPartnerProps {
  partnerId: string;
}

export async function EditPartner({ partnerId }: EditPartnerProps) {
  const partner = await getPartnerById(partnerId);

  if (!partner) {
    notFound();
  }

  return (
    <PermissionGuard module="commercial.treasury.partners" action="update" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editar Socio</h1>
          <p className="text-sm text-muted-foreground">
            Modifica la información del socio: {partner.name}
          </p>
        </div>

        <_EditPartnerForm partner={partner} />
      </div>
    </PermissionGuard>
  );
}
