import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getSystemActions, getPermissionsConfig } from './actions.server';
import { _RoleForm } from './components/_RoleForm';

export async function RoleCreate() {
  const [systemActions, permissionsConfig] = await Promise.all([
    getSystemActions(),
    getPermissionsConfig(),
  ]);

  return (
    <PermissionGuard module="company.general.roles" action="create" redirect>
      <_RoleForm
        systemActions={systemActions}
        permissionsConfig={permissionsConfig}
      />
    </PermissionGuard>
  );
}
