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

export interface CreateTypeOperativeInput {
  name: string;
}

export interface UpdateTypeOperativeInput {
  name?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene tipos operativos con paginacion server-side para DataTable
 */
export async function getTypeOperativesPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.type-operatives', 'view', { redirect: true });

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
      prisma.typeOperative.findMany({
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
      prisma.typeOperative.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener tipos operativos paginados', { data: { error, companyId } });
    throw new Error('Error al obtener tipos operativos');
  }
}

/**
 * Obtiene todos los tipos operativos de la empresa activa (sin paginacion)
 * @deprecated Usar getTypeOperativesPaginated para listas con DataTable
 */
export async function getAllTypeOperatives() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.type-operatives', 'view', { redirect: true });

  try {
    return await prisma.typeOperative.findMany({
      where: { companyId, isActive: true },
      include: { _count: { select: { vehicles: true } } },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener tipos operativos', { data: { error } });
    throw new Error('Error al obtener tipos operativos');
  }
}

/**
 * Obtiene tipos operativos para select (solo id y nombre)
 */
export async function getTypeOperativesForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.typeOperative.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener tipos operativos para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un tipo operativo por ID
 */
export async function getTypeOperativeById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.type-operatives', 'view', { redirect: true });

  try {
    const typeOperative = await prisma.typeOperative.findFirst({
      where: { id, companyId },
    });
    if (!typeOperative) throw new Error('Tipo operativo no encontrado');
    return typeOperative;
  } catch (error) {
    logger.error('Error al obtener tipo operativo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo tipo operativo
 */
export async function createTypeOperative(input: CreateTypeOperativeInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.type-operatives', 'create', { redirect: true });

  try {
    const typeOperative = await prisma.typeOperative.create({
      data: {
        name: input.name,
        companyId,
      },
    });

    logger.info('Tipo operativo creado', { data: { id: typeOperative.id, companyId } });
    revalidatePath('/dashboard/company/type-operatives');

    return typeOperative;
  } catch (error) {
    logger.error('Error al crear tipo operativo', { data: { error, companyId } });
    throw new Error('Error al crear tipo operativo');
  }
}

/**
 * Actualiza un tipo operativo
 */
export async function updateTypeOperative(id: string, input: UpdateTypeOperativeInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.type-operatives', 'update', { redirect: true });

  try {
    const existing = await prisma.typeOperative.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Tipo operativo no encontrado');
    }

    const typeOperative = await prisma.typeOperative.update({
      where: { id },
      data: {
        name: input.name,
      },
    });

    logger.info('Tipo operativo actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/type-operatives');

    return typeOperative;
  } catch (error) {
    logger.error('Error al actualizar tipo operativo', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un tipo operativo (soft delete)
 */
export async function deleteTypeOperative(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.type-operatives', 'delete', { redirect: true });

  try {
    const existing = await prisma.typeOperative.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Tipo operativo no encontrado');
    }

    await prisma.typeOperative.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Tipo operativo eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/type-operatives');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar tipo operativo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type TypeOperativeListItem = Awaited<ReturnType<typeof getTypeOperativesPaginated>>['data'][number];
export type TypeOperative = Awaited<ReturnType<typeof getTypeOperativeById>>;
export type TypeOperativeOption = Awaited<ReturnType<typeof getTypeOperativesForSelect>>[number];
