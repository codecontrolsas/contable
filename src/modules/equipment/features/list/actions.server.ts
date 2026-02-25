'use server';

import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildFiltersWhere,
  buildSearchWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import {
  createJournalEntryForAssetSale,
  createJournalEntryForAssetDisposal,
} from '@/modules/accounting/features/integrations/equipment';

// ============================================
// CONSTANTES
// ============================================

// Select optimizado para relaciones - solo id y name
const relationSelect = { select: { id: true, name: true } } as const;

// ============================================
// TIPOS
// ============================================

export type EquipmentTab = 'all' | 'vehicles' | 'others';

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene equipos con paginación server-side para DataTable
 * Soporta filtrado por tab (Todos, Vehículos, Otros)
 */
export async function getEquipmentPaginated(
  searchParams: DataTableSearchParams,
  tab: EquipmentTab = 'all'
) {
  await checkPermission('equipment', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, [
      'internNumber',
      'domain',
      'chassis',
      'engine',
    ]);

    // Excluir 'tab' de los filtros (se maneja aparte)
    const { tab: _tab, ...cleanFilters } = state.filters;

    // Construir cláusula de filtros
    const filtersWhere = buildFiltersWhere(cleanFilters, {
      status: 'status',
      condition: 'condition',
      type: 'typeId',
      brand: 'brandId',
      isActive: 'isActive',
    });

    // Transformar isActive de string a boolean si existe
    if (filtersWhere.isActive) {
      filtersWhere.isActive = filtersWhere.isActive === 'true';
    }

    // Filtrado por tab usando TypeOfVehicle
    let tabWhere = {};
    if (tab === 'vehicles') {
      // Buscar el TypeOfVehicle que representa "Vehículos"
      const vehicleType = await prisma.typeOfVehicle.findFirst({
        where: {
          companyId,
          name: { equals: 'Vehículos', mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (vehicleType) {
        tabWhere = { typeOfVehicleId: vehicleType.id };
      }
    } else if (tab === 'others') {
      // Buscar el TypeOfVehicle que representa "Vehículos" para excluirlo
      const vehicleType = await prisma.typeOfVehicle.findFirst({
        where: {
          companyId,
          name: { equals: 'Vehículos', mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (vehicleType) {
        tabWhere = { NOT: { typeOfVehicleId: vehicleType.id } };
      }
    }

    const where = {
      companyId,
      ...tabWhere,
      ...searchWhere,
      ...filtersWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          brand: relationSelect,
          model: relationSelect,
          type: relationSelect,
          typeOfVehicle: relationSelect,
          costCenter: relationSelect,
          sector: relationSelect,
          typeOperative: relationSelect,
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener equipos paginados', { data: { error, companyId } });
    throw new Error('Error al obtener equipos');
  }
}

/**
 * Obtiene contadores para cada tab
 */
export async function getEquipmentTabCounts() {
  await checkPermission('equipment', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) return { all: 0, vehicles: 0, others: 0 };

  try {
    // Buscar el TypeOfVehicle que representa "Vehículos"
    const vehicleType = await prisma.typeOfVehicle.findFirst({
      where: {
        companyId,
        name: { equals: 'Vehículos', mode: 'insensitive' },
      },
      select: { id: true },
    });

    const [all, vehicles, others] = await Promise.all([
      prisma.vehicle.count({ where: { companyId } }),
      vehicleType
        ? prisma.vehicle.count({ where: { companyId, typeOfVehicleId: vehicleType.id } })
        : Promise.resolve(0),
      vehicleType
        ? prisma.vehicle.count({ where: { companyId, NOT: { typeOfVehicleId: vehicleType.id } } })
        : prisma.vehicle.count({ where: { companyId } }),
    ]);

    return { all, vehicles, others };
  } catch (error) {
    logger.error('Error al obtener contadores de tabs', { data: { error } });
    return { all: 0, vehicles: 0, others: 0 };
  }
}

/**
 * Obtiene tipos de vehículo para filtros
 */
export async function getVehicleTypesForFilter() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.vehicleType.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener tipos de vehículo para filtro', { data: { error } });
    return [];
  }
}

/**
 * Obtiene marcas de vehículo para filtros
 */
export async function getVehicleBrandsForFilter() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.vehicleBrand.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener marcas para filtro', { data: { error } });
    return [];
  }
}

/**
 * Obtiene todos los vehículos/equipos de la empresa activa (sin paginación)
 * @deprecated Usar getEquipmentPaginated para listas grandes
 */
export async function getAllVehicles() {
  await checkPermission('equipment', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.vehicle.findMany({
      where: { companyId },
      include: {
        brand: relationSelect,
        model: relationSelect,
        type: relationSelect,
        typeOfVehicle: relationSelect,
        costCenter: relationSelect,
        sector: relationSelect,
        typeOperative: relationSelect,
        contractorAllocations: {
          select: {
            contractor: relationSelect,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error getting vehicles', { data: { error } });
    throw new Error('Error al obtener vehículos');
  }
}

/**
 * Obtiene solo los vehículos activos
 */
export async function getActiveVehicles() {
  await checkPermission('equipment', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.vehicle.findMany({
      where: {
        companyId,
        isActive: true,
      },
      include: {
        brand: relationSelect,
        model: relationSelect,
        type: relationSelect,
        typeOfVehicle: relationSelect,
        costCenter: relationSelect,
        sector: relationSelect,
        typeOperative: relationSelect,
        contractorAllocations: {
          select: {
            contractor: relationSelect,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error getting active vehicles', { data: { error } });
    throw new Error('Error al obtener vehículos activos');
  }
}

/**
 * Elimina (soft delete) un vehículo.
 * Si tiene depreciación configurada, genera asiento contable de baja
 * y marca la depreciación como completada.
 */
export async function softDeleteVehicle(
  id: string,
  terminationReason: 'SALE' | 'TOTAL_LOSS' | 'RETURN' | 'OTHER'
) {
  await checkPermission('equipment', 'delete', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.$transaction(async (tx) => {
      // Dar de baja el vehículo
      const vehicle = await tx.vehicle.update({
        where: { id, companyId },
        data: {
          isActive: false,
          terminationDate: new Date(),
          terminationReason,
        },
      });

      // Generar asiento contable de baja si tiene depreciación
      if (terminationReason === 'SALE') {
        await createJournalEntryForAssetSale(id, companyId, tx);
      } else if (terminationReason === 'TOTAL_LOSS' || terminationReason === 'RETURN') {
        await createJournalEntryForAssetDisposal(id, companyId, tx);
      }

      // Marcar depreciación como completada
      const depreciation = await tx.vehicleDepreciation.findUnique({
        where: { vehicleId: id },
        select: { id: true },
      });

      if (depreciation) {
        await tx.vehicleDepreciation.update({
          where: { id: depreciation.id },
          data: { status: 'COMPLETED' },
        });
      }

      return vehicle;
    });
  } catch (error) {
    logger.error('Error deleting vehicle', { data: { error, id } });
    throw new Error('Error al dar de baja el vehículo');
  }
}

/**
 * Reactiva un vehículo dado de baja
 */
export async function reactivateVehicle(id: string) {
  await checkPermission('equipment', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.vehicle.update({
      where: { id, companyId },
      data: {
        isActive: true,
        terminationDate: null,
        terminationReason: null,
      },
    });
  } catch (error) {
    logger.error('Error reactivating vehicle', { data: { error, id } });
    throw new Error('Error al reactivar el vehículo');
  }
}

// ============================================
// EXPORT
// ============================================

/**
 * Obtiene TODOS los equipos con los filtros actuales (para exportar a Excel)
 * Usa los mismos filtros que getEquipmentPaginated pero sin paginación
 */
export async function getAllEquipmentForExport(
  searchParams: DataTableSearchParams,
  tab: EquipmentTab = 'all'
) {
  await checkPermission('equipment', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const state = parseSearchParams(searchParams);

    const searchWhere = buildSearchWhere(state.search, [
      'internNumber',
      'domain',
      'chassis',
      'engine',
    ]);

    const { tab: _tab, ...cleanFilters } = state.filters;

    const filtersWhere = buildFiltersWhere(cleanFilters, {
      status: 'status',
      condition: 'condition',
      type: 'typeId',
      brand: 'brandId',
      isActive: 'isActive',
    });

    if (filtersWhere.isActive) {
      filtersWhere.isActive = filtersWhere.isActive === 'true';
    }

    let tabWhere = {};
    if (tab === 'vehicles') {
      const vehicleType = await prisma.typeOfVehicle.findFirst({
        where: { companyId, name: { equals: 'Vehículos', mode: 'insensitive' } },
        select: { id: true },
      });
      if (vehicleType) {
        tabWhere = { typeOfVehicleId: vehicleType.id };
      }
    } else if (tab === 'others') {
      const vehicleType = await prisma.typeOfVehicle.findFirst({
        where: { companyId, name: { equals: 'Vehículos', mode: 'insensitive' } },
        select: { id: true },
      });
      if (vehicleType) {
        tabWhere = { NOT: { typeOfVehicleId: vehicleType.id } };
      }
    }

    const where = {
      companyId,
      ...tabWhere,
      ...searchWhere,
      ...filtersWhere,
    };

    // SIN skip/take para obtener todos
    return await prisma.vehicle.findMany({
      where,
      orderBy: state.sortBy ? { [state.sortBy]: state.sortOrder } : { createdAt: 'desc' },
      include: {
        brand: relationSelect,
        model: relationSelect,
        type: relationSelect,
        typeOfVehicle: relationSelect,
        costCenter: relationSelect,
        sector: relationSelect,
        typeOperative: relationSelect,
      },
    });
  } catch (error) {
    logger.error('Error al obtener equipos para exportar', { data: { error } });
    throw new Error('Error al obtener equipos para exportar');
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type EquipmentListItem = Awaited<ReturnType<typeof getEquipmentPaginated>>['data'][number];
export type VehicleListItem = Awaited<ReturnType<typeof getAllVehicles>>[number];
export type VehicleTypeOption = Awaited<ReturnType<typeof getVehicleTypesForFilter>>[number];
export type VehicleBrandOption = Awaited<ReturnType<typeof getVehicleBrandsForFilter>>[number];
export type TabCounts = Awaited<ReturnType<typeof getEquipmentTabCounts>>;
