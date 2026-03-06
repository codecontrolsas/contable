import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getModulePermissions } from '@/shared/lib/permissions';

import {
  getEquipmentFacetCounts,
  getEquipmentPaginated,
  getEquipmentTabCounts,
  getVehicleBrandsForFilter,
  getVehicleTypesForFilter,
  type EquipmentTab,
} from './actions.server';
import { _EquipmentDataTable } from './components/_EquipmentDataTable';

interface Props {
  searchParams: DataTableSearchParams;
}

export async function EquipmentList({ searchParams }: Props) {
  // Obtener tab actual de searchParams (default: 'all')
  const currentTab = (searchParams.tab as EquipmentTab) || 'all';

  // Fetch data, opciones de filtros, conteos facetados y permisos en paralelo
  const [{ data, total }, tabCounts, vehicleTypes, vehicleBrands, facetCounts, permissions] = await Promise.all([
    getEquipmentPaginated(searchParams, currentTab),
    getEquipmentTabCounts(),
    getVehicleTypesForFilter(),
    getVehicleBrandsForFilter(),
    getEquipmentFacetCounts(),
    getModulePermissions('equipment'),
  ]);

  return (
    <PermissionGuard module="equipment" action="view" redirect>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 data-testid="equipment-page-title" className="text-3xl font-bold tracking-tight">
              Equipos
            </h1>
            <p className="text-muted-foreground">Gestiona los vehículos y equipos de tu empresa</p>
          </div>
        </div>

        <_EquipmentDataTable
          data={data}
          totalRows={total}
          searchParams={searchParams}
          tabCounts={tabCounts}
          currentTab={currentTab}
          vehicleTypes={vehicleTypes}
          vehicleBrands={vehicleBrands}
          facetCounts={facetCounts}
          permissions={permissions}
        />
      </div>
    </PermissionGuard>
  );
}
