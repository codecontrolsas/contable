'use server';

import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildSearchWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import { checkPermission } from '@/shared/lib/permissions';

// Select optimizado para relaciones - solo id y name
const selectForDropdown = { id: true, name: true } as const;

// ============================================
// TIPOS
// ============================================

export interface CreateVehicleBrandInput {
  name: string;
}

export interface UpdateVehicleBrandInput {
  name?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene marcas de vehiculos con paginacion server-side para DataTable
 */
export async function getVehicleBrandsPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'view', { redirect: true });

  try {
    // Parsear parametros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir clausula de busqueda
    const searchWhere = buildSearchWhere(state.search, ['name']);

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.vehicleBrand.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
        select: {
          ...selectForDropdown,
        },
      }),
      prisma.vehicleBrand.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener marcas de vehiculos paginadas', { data: { error, companyId } });
    throw new Error('Error al obtener marcas de vehiculos');
  }
}

/**
 * Obtiene todas las marcas de vehiculos de la empresa activa (sin paginacion)
 * @deprecated Usar getVehicleBrandsPaginated para listas con DataTable
 */
export async function getAllVehicleBrands() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'view', { redirect: true });

  try {
    return await prisma.vehicleBrand.findMany({
      where: { companyId, isActive: true },
      select: {
        ...selectForDropdown,
        models: {
          where: { isActive: true },
          select: selectForDropdown,
          orderBy: { name: 'asc' },
        },
        _count: { select: { vehicles: true } },
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener marcas de vehículos', { data: { error } });
    throw new Error('Error al obtener marcas de vehículos');
  }
}

export async function getVehicleBrandsForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.vehicleBrand.findMany({
      where: { companyId, isActive: true },
      select: selectForDropdown,
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener marcas para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene marcas con sus modelos para select con dependencia (brand → model)
 */
export async function getVehicleBrandsWithModelsForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.vehicleBrand.findMany({
      where: { companyId, isActive: true },
      select: {
        ...selectForDropdown,
        models: {
          where: { isActive: true },
          select: selectForDropdown,
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener marcas con modelos para select', { data: { error } });
    return [];
  }
}

export async function getVehicleBrandById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'view', { redirect: true });

  try {
    const brand = await prisma.vehicleBrand.findFirst({
      where: { id, companyId },
      select: {
        ...selectForDropdown,
        models: {
          where: { isActive: true },
          select: selectForDropdown,
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!brand) throw new Error('Marca no encontrada');
    return brand;
  } catch (error) {
    logger.error('Error al obtener marca', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

export async function createVehicleBrand(input: CreateVehicleBrandInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'create', { redirect: true });

  try {
    const brand = await prisma.vehicleBrand.create({
      data: { name: input.name, companyId },
      select: { id: true },
    });

    logger.info('Marca de vehículo creada', { data: { id: brand.id } });
    revalidatePath('/dashboard/company/vehicle-brands');
    return brand;
  } catch (error) {
    logger.error('Error al crear marca', { data: { error } });
    throw new Error('Error al crear marca de vehículo');
  }
}

export async function updateVehicleBrand(id: string, input: UpdateVehicleBrandInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'update', { redirect: true });

  try {
    const existing = await prisma.vehicleBrand.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new Error('Marca no encontrada');

    const brand = await prisma.vehicleBrand.update({
      where: { id },
      data: { name: input.name },
      select: { id: true },
    });

    logger.info('Marca actualizada', { data: { id } });
    revalidatePath('/dashboard/company/vehicle-brands');
    return brand;
  } catch (error) {
    logger.error('Error al actualizar marca', { data: { error, id } });
    throw error;
  }
}

export async function deleteVehicleBrand(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'delete', { redirect: true });

  try {
    const existing = await prisma.vehicleBrand.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new Error('Marca no encontrada');

    await prisma.vehicleBrand.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Marca eliminada', { data: { id } });
    revalidatePath('/dashboard/company/vehicle-brands');
    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar marca', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS - MODELOS (inline en tabla)
// ============================================

export interface CreateVehicleModelInput {
  name: string;
  brandId: string;
}

export async function createVehicleModel(input: CreateVehicleModelInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'create', { redirect: true });

  try {
    // Verificar que la marca pertenece a la empresa
    const brand = await prisma.vehicleBrand.findFirst({
      where: { id: input.brandId, companyId },
      select: { id: true },
    });
    if (!brand) throw new Error('Marca no encontrada');

    const model = await prisma.vehicleModel.create({
      data: { name: input.name, brandId: input.brandId },
      select: { id: true },
    });

    logger.info('Modelo de vehículo creado', { data: { id: model.id } });
    revalidatePath('/dashboard/company/vehicle-brands');
    return model;
  } catch (error) {
    logger.error('Error al crear modelo', { data: { error } });
    throw new Error('Error al crear modelo de vehículo');
  }
}

export async function deleteVehicleModel(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-brands', 'delete', { redirect: true });

  try {
    const model = await prisma.vehicleModel.findUnique({
      where: { id },
      select: { brand: { select: { companyId: true } } },
    });

    if (!model || model.brand.companyId !== companyId) {
      throw new Error('Modelo no encontrado');
    }

    await prisma.vehicleModel.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Modelo eliminado', { data: { id } });
    revalidatePath('/dashboard/company/vehicle-brands');
    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar modelo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type VehicleBrandListItem = Awaited<ReturnType<typeof getVehicleBrandsPaginated>>['data'][number];
export type VehicleBrandSelectItem = Awaited<ReturnType<typeof getVehicleBrandsForSelect>>[number];
export type VehicleBrandWithModelsOption = Awaited<ReturnType<typeof getVehicleBrandsWithModelsForSelect>>[number];
export type VehicleBrand = Awaited<ReturnType<typeof getVehicleBrandById>>;
