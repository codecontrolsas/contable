'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { revalidatePath } from 'next/cache';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildSearchWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';

// ============================================
// TIPOS
// ============================================

export interface CreateCostCenterInput {
  name: string;
}

export interface UpdateCostCenterInput {
  name?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene centros de costo con paginación server-side para DataTable
 */
export async function getCostCentersPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.cost-centers', 'view', { redirect: true });

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
      prisma.costCenter.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
      }),
      prisma.costCenter.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener centros de costo paginados', { data: { error, companyId } });
    throw new Error('Error al obtener centros de costo');
  }
}

/**
 * Obtiene todos los centros de costo de la empresa activa (sin paginación)
 * @deprecated Usar getCostCentersPaginated para listas con DataTable
 */
export async function getAllCostCenters() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.cost-centers', 'view', { redirect: true });

  try {
    const costCenters = await prisma.costCenter.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return costCenters;
  } catch (error) {
    logger.error('Error al obtener centros de costo', { data: { error, companyId } });
    throw new Error('Error al obtener centros de costo');
  }
}

/**
 * Obtiene centros de costo para select (solo id y nombre)
 */
export async function getCostCentersForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const costCenters = await prisma.costCenter.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return costCenters;
  } catch (error) {
    logger.error('Error al obtener centros de costo para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un centro de costo por ID
 */
export async function getCostCenterById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.cost-centers', 'view', { redirect: true });

  try {
    const costCenter = await prisma.costCenter.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!costCenter) {
      throw new Error('Centro de costo no encontrado');
    }

    return costCenter;
  } catch (error) {
    logger.error('Error al obtener centro de costo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo centro de costo
 */
export async function createCostCenter(input: CreateCostCenterInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.cost-centers', 'create', { redirect: true });

  try {
    const costCenter = await prisma.costCenter.create({
      data: {
        name: input.name,
        companyId,
      },
    });

    logger.info('Centro de costo creado', { data: { id: costCenter.id, companyId } });
    revalidatePath('/dashboard/company/cost-centers');

    return costCenter;
  } catch (error) {
    logger.error('Error al crear centro de costo', { data: { error, companyId } });
    throw new Error('Error al crear centro de costo');
  }
}

/**
 * Actualiza un centro de costo
 */
export async function updateCostCenter(id: string, input: UpdateCostCenterInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.cost-centers', 'update', { redirect: true });

  try {
    const existing = await prisma.costCenter.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Centro de costo no encontrado');
    }

    const costCenter = await prisma.costCenter.update({
      where: { id },
      data: {
        name: input.name,
      },
      select: { id: true },
    });

    logger.info('Centro de costo actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/cost-centers');

    return costCenter;
  } catch (error) {
    logger.error('Error al actualizar centro de costo', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un centro de costo (soft delete)
 */
export async function deleteCostCenter(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.cost-centers', 'delete', { redirect: true });

  try {
    const existing = await prisma.costCenter.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Centro de costo no encontrado');
    }

    await prisma.costCenter.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Centro de costo eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/cost-centers');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar centro de costo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CostCenterListItem = Awaited<ReturnType<typeof getCostCentersPaginated>>['data'][number];
export type CostCenter = Awaited<ReturnType<typeof getCostCenterById>>;
export type CostCenterOption = Awaited<ReturnType<typeof getCostCentersForSelect>>[number];
