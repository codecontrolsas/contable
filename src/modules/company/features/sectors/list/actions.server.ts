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

export interface CreateSectorInput {
  name: string;
  shortDescription?: string;
}

export interface UpdateSectorInput {
  name?: string;
  shortDescription?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene sectores con paginación server-side para DataTable
 */
export async function getSectorsPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.sectors', 'view', { redirect: true });

  try {
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);
    const searchWhere = buildSearchWhere(state.search, ['name']);

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
    };

    const [data, total] = await Promise.all([
      prisma.sector.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
        include: { _count: { select: { vehicles: true } } },
      }),
      prisma.sector.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener sectores paginados', { data: { error, companyId } });
    throw new Error('Error al obtener sectores');
  }
}

/**
 * Obtiene todos los sectores de la empresa activa
 * @deprecated Usar getSectorsPaginated para listas con DataTable
 */
export async function getAllSectors() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.sectors', 'view', { redirect: true });

  try {
    const sectors = await prisma.sector.findMany({
      where: { companyId, isActive: true },
      include: { _count: { select: { vehicles: true } } },
      orderBy: { name: 'asc' },
    });

    return sectors;
  } catch (error) {
    logger.error('Error al obtener sectores', { data: { error, companyId } });
    throw new Error('Error al obtener sectores');
  }
}

/**
 * Obtiene sectores para select (solo id y nombre)
 */
export async function getSectorsForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const sectors = await prisma.sector.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return sectors;
  } catch (error) {
    logger.error('Error al obtener sectores para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un sector por ID
 */
export async function getSectorById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.sectors', 'view', { redirect: true });

  try {
    const sector = await prisma.sector.findFirst({
      where: { id, companyId },
      include: {
        vehicles: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!sector) {
      throw new Error('Sector no encontrado');
    }

    return sector;
  } catch (error) {
    logger.error('Error al obtener sector', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo sector
 */
export async function createSector(input: CreateSectorInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.sectors', 'create', { redirect: true });

  try {
    const sector = await prisma.sector.create({
      data: {
        name: input.name,
        shortDescription: input.shortDescription || null,
        companyId,
      },
    });

    logger.info('Sector creado', { data: { id: sector.id, companyId } });
    revalidatePath('/dashboard/company/sectors');

    return sector;
  } catch (error) {
    logger.error('Error al crear sector', { data: { error, companyId } });
    throw new Error('Error al crear sector');
  }
}

/**
 * Actualiza un sector
 */
export async function updateSector(id: string, input: UpdateSectorInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.sectors', 'update', { redirect: true });

  try {
    const existing = await prisma.sector.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Sector no encontrado');
    }

    const sector = await prisma.sector.update({
      where: { id },
      data: {
        name: input.name,
        shortDescription: input.shortDescription,
      },
    });

    logger.info('Sector actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/sectors');

    return sector;
  } catch (error) {
    logger.error('Error al actualizar sector', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un sector (soft delete)
 */
export async function deleteSector(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.sectors', 'delete', { redirect: true });

  try {
    const existing = await prisma.sector.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Sector no encontrado');
    }

    await prisma.sector.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Sector eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/sectors');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar sector', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type SectorListItem = Awaited<ReturnType<typeof getSectorsPaginated>>['data'][number];
export type Sector = Awaited<ReturnType<typeof getSectorById>>;
export type SectorOption = Awaited<ReturnType<typeof getSectorsForSelect>>[number];
