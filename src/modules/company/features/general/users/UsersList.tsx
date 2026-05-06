import { getCurrentUserId } from '@/shared/lib/current-user';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getModulePermissions } from '@/shared/lib/permissions';

import {
  getCompanyMembersPaginated,
  getPendingInvitations,
  getAvailableRoles,
  getAvailableEmployeesForInvitation,
} from './actions.server';
import { _UsersDataTable } from './components/_UsersDataTable';

interface Props {
  searchParams: DataTableSearchParams;
}

export async function UsersList({ searchParams }: Props) {
  const userId = await getCurrentUserId();

  const [
    membersResult,
    pendingInvitations,
    availableRoles,
    availableEmployees,
    permissions,
  ] = await Promise.all([
    getCompanyMembersPaginated(searchParams),
    getPendingInvitations(),
    getAvailableRoles(),
    getAvailableEmployeesForInvitation(),
    getModulePermissions('company.general.users'),
  ]);

  return (
    <PermissionGuard module="company.general.users" action="view" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground">
            Gestiona los usuarios que tienen acceso a la empresa
          </p>
        </div>

        <_UsersDataTable
          data={membersResult.data}
          totalRows={membersResult.total}
          searchParams={searchParams}
          pendingInvitations={pendingInvitations}
          availableRoles={availableRoles}
          availableEmployees={availableEmployees}
          currentUserId={userId ?? ''}
          permissions={permissions}
        />
      </div>
    </PermissionGuard>
  );
}
