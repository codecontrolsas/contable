import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getModulePermissions } from '@/shared/lib/permissions';
import { getPartners, getPartnerFacetCounts } from './actions.server';
import { _PartnersTable } from './components/_PartnersTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function PartnersList({ searchParams = {} }: Props) {
  const [result, permissions, facetCounts] = await Promise.all([
    getPartners(searchParams),
    getModulePermissions('commercial.treasury.partners'),
    getPartnerFacetCounts(),
  ]);

  return (
    <PermissionGuard module="commercial.treasury.partners" action="view" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Socios</h1>
          <p className="text-muted-foreground">
            Gestiona los socios de tu empresa y su cuenta corriente
          </p>
        </div>

        <_PartnersTable
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
