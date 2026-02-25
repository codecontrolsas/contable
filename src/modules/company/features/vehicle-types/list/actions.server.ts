'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { revalidatePath } from 'next/cache';
import { getActiveCompanyId } from '@/shared/lib/company';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildSearchWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import { checkPermission } from '@/shared/lib/permissions';

// ============================================
// TIPOS
// ============================================

export interface CreateVehicleTypeInput {
  name: string;
  hasHitch?: boolean;
  isTractorUnit?: boolean;
}

export interface UpdateVehicleTypeInput {
  name?: string;
  hasHitch?: boolean;
  isTractorUnit?: boolean;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene tipos de equipo con paginación server-side para DataTable
 */
export async function getVehicleTypesPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-types', 'view', { redirect: true });

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, ['name']);

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.vehicleType.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
        include: {
          _count: {
            select: { vehicles: true },
          },
        },
      }),
      prisma.vehicleType.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener tipos de equipo paginados', { data: { error, companyId } });
    throw new Error('Error al obtener tipos de equipo');
  }
}

/**
 * Obtiene todos los tipos de equipo de la empresa activa (sin paginación)
 * @deprecated Usar getVehicleTypesPaginated para listas con DataTable
 */
export async function getAllVehicleTypes() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-types', 'view', { redirect: true });

  try {
    return await prisma.vehicleType.findMany({
      where: { companyId, isActive: true },
      include: { _count: { select: { vehicles: true } } },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener tipos de equipo', { data: { error } });
    throw new Error('Error al obtener tipos de equipo');
  }
}

/**
 * Obtiene tipos de equipo para select (solo campos necesarios)
 */
export async function getVehicleTypesForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.vehicleType.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, hasHitch: true, isTractorUnit: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener tipos para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un tipo de equipo por ID
 */
export async function getVehicleTypeById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-types', 'view', { redirect: true });

  try {
    const type = await prisma.vehicleType.findFirst({
      where: { id, companyId },
    });
    if (!type) throw new Error('Tipo de equipo no encontrado');
    return type;
  } catch (error) {
    logger.error('Error al obtener tipo de equipo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo tipo de equipo
 */
export async function createVehicleType(input: CreateVehicleTypeInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-types', 'create', { redirect: true });

  try {
    const type = await prisma.vehicleType.create({
      data: {
        name: input.name,
        hasHitch: input.hasHitch || false,
        isTractorUnit: input.isTractorUnit || false,
        companyId,
      },
      select: { id: true },
    });

    logger.info('Tipo de equipo creado', { data: { id: type.id, companyId } });
    revalidatePath('/dashboard/company/vehicle-types');
    return type;
  } catch (error) {
    logger.error('Error al crear tipo de equipo', { data: { error, companyId } });
    throw new Error('Error al crear tipo de equipo');
  }
}

/**
 * Actualiza un tipo de equipo
 */
export async function updateVehicleType(id: string, input: UpdateVehicleTypeInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-types', 'update', { redirect: true });

  try {
    const existing = await prisma.vehicleType.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Tipo de equipo no encontrado');
    }

    const type = await prisma.vehicleType.update({
      where: { id },
      data: {
        name: input.name,
        hasHitch: input.hasHitch,
        isTractorUnit: input.isTractorUnit,
      },
      select: { id: true },
    });

    logger.info('Tipo de equipo actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/vehicle-types');
    return type;
  } catch (error) {
    logger.error('Error al actualizar tipo de equipo', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un tipo de equipo (soft delete)
 */
export async function deleteVehicleType(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.vehicle-types', 'delete', { redirect: true });

  try {
    const existing = await prisma.vehicleType.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Tipo de equipo no encontrado');
    }

    await prisma.vehicleType.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Tipo de equipo eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/vehicle-types');
    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar tipo de equipo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type VehicleTypeListItem = Awaited<ReturnType<typeof getVehicleTypesPaginated>>['data'][number];
export type VehicleTypeSelectItem = Awaited<ReturnType<typeof getVehicleTypesForSelect>>[number];
export type VehicleType = Awaited<ReturnType<typeof getVehicleTypeById>>;
