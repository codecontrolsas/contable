import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { parseSearchParams } from '@/shared/components/common/DataTable/helpers';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getModulePermissions } from '@/shared/lib/permissions';
import { getClients, getClientFacetCounts } from './actions.server';
import { _ClientsDataTable } from './components/_ClientsDataTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function ClientsList({ searchParams = {} }: Props) {
  const state = parseSearchParams(searchParams);
  const page = state.page + 1;
  const { pageSize, filters } = state;

  const [result, permissions, facetCounts] = await Promise.all([
    getClients({
      page,
      pageSize,
      filters,
    }),
    getModulePermissions('commercial.clients'),
    getClientFacetCounts(),
  ]);

  return (
    <PermissionGuard module="commercial.clients" action="view" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona los clientes de tu empresa
          </p>
        </div>

        <_ClientsDataTable
          data={result.data}
          totalRows={result.pagination.total}
          searchParams={searchParams}
          permissions={permissions}
          facetCounts={facetCounts}
        />
      </div>
    </PermissionGuard>
  );
}
