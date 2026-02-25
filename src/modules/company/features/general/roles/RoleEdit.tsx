import { notFound } from 'next/navigation';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import {
  getRoleById,
  getSystemActions,
  getPermissionsConfig,
} from './actions.server';
import { _RoleForm } from './components/_RoleForm';

interface Props {
  roleId: string;
}

export async function RoleEdit({ roleId }: Props) {
  const [role, systemActions, permissionsConfig] = await Promise.all([
    getRoleById(roleId),
    getSystemActions(),
    getPermissionsConfig(),
  ]);

  if (!role) {
    notFound();
  }

  return (
    <PermissionGuard module="company.general.roles" action="update" redirect>
      <_RoleForm
        role={role}
        systemActions={systemActions}
        permissionsConfig={permissionsConfig}
      />
    </PermissionGuard>
  );
}
