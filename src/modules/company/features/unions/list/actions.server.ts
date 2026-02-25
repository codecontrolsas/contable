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

export interface CreateUnionInput {
  name: string;
}

export interface UpdateUnionInput {
  name?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene sindicatos con paginación server-side para DataTable
 */
export async function getUnionsPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.unions', 'view', { redirect: true });

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
      prisma.union.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
        include: {
          _count: {
            select: { collectiveAgreements: true },
          },
        },
      }),
      prisma.union.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener sindicatos paginados', { data: { error, companyId } });
    throw new Error('Error al obtener sindicatos');
  }
}

/**
 * Obtiene todos los sindicatos de la empresa activa (sin paginación)
 * @deprecated Usar getUnionsPaginated para listas con DataTable
 */
export async function getAllUnions() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.unions', 'view', { redirect: true });

  try {
    const unions = await prisma.union.findMany({
      where: {
        companyId,
        isActive: true,
      },
      include: {
        _count: {
          select: { collectiveAgreements: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return unions;
  } catch (error) {
    logger.error('Error al obtener sindicatos', { data: { error, companyId } });
    throw new Error('Error al obtener sindicatos');
  }
}

/**
 * Obtiene sindicatos para select (solo id y nombre)
 */
export async function getUnionsForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const unions = await prisma.union.findMany({
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

    return unions;
  } catch (error) {
    logger.error('Error al obtener sindicatos para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un sindicato por ID
 */
export async function getUnionById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.unions', 'view', { redirect: true });

  try {
    const union = await prisma.union.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        collectiveAgreements: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!union) {
      throw new Error('Sindicato no encontrado');
    }

    return union;
  } catch (error) {
    logger.error('Error al obtener sindicato', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo sindicato
 */
export async function createUnion(input: CreateUnionInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.unions', 'create', { redirect: true });

  try {
    const union = await prisma.union.create({
      data: {
        name: input.name,
        companyId,
      },
      select: { id: true },
    });

    logger.info('Sindicato creado', { data: { id: union.id, companyId } });
    revalidatePath('/dashboard/company/unions');

    return union;
  } catch (error) {
    logger.error('Error al crear sindicato', { data: { error, companyId } });
    throw new Error('Error al crear sindicato');
  }
}

/**
 * Actualiza un sindicato
 */
export async function updateUnion(id: string, input: UpdateUnionInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.unions', 'update', { redirect: true });

  try {
    const existing = await prisma.union.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Sindicato no encontrado');
    }

    const union = await prisma.union.update({
      where: { id },
      data: {
        name: input.name,
      },
      select: { id: true },
    });

    logger.info('Sindicato actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/unions');

    return union;
  } catch (error) {
    logger.error('Error al actualizar sindicato', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un sindicato (soft delete)
 */
export async function deleteUnion(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.unions', 'delete', { redirect: true });

  try {
    const existing = await prisma.union.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Sindicato no encontrado');
    }

    await prisma.union.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Sindicato eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/unions');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar sindicato', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type UnionListItem = Awaited<ReturnType<typeof getUnionsPaginated>>['data'][number];
export type Union = Awaited<ReturnType<typeof getUnionById>>;
export type UnionOption = Awaited<ReturnType<typeof getUnionsForSelect>>[number];
