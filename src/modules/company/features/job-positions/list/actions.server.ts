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

export interface CreateJobPositionInput {
  name: string;
  description?: string;
}

export interface UpdateJobPositionInput {
  name?: string;
  description?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene puestos de trabajo con paginación server-side para DataTable
 */
export async function getJobPositionsPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-positions', 'view', { redirect: true });

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
      prisma.jobPosition.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
      }),
      prisma.jobPosition.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener puestos de trabajo paginados', { data: { error, companyId } });
    throw new Error('Error al obtener puestos de trabajo');
  }
}

/**
 * Obtiene todos los puestos de trabajo de la empresa activa
 * @deprecated Usar getJobPositionsPaginated para listas con DataTable
 */
export async function getAllJobPositions() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-positions', 'view', { redirect: true });

  try {
    const jobPositions = await prisma.jobPosition.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return jobPositions;
  } catch (error) {
    logger.error('Error al obtener puestos de trabajo', { data: { error, companyId } });
    throw new Error('Error al obtener puestos de trabajo');
  }
}

/**
 * Obtiene puestos de trabajo para select (solo id y nombre)
 */
export async function getJobPositionsForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const jobPositions = await prisma.jobPosition.findMany({
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

    return jobPositions;
  } catch (error) {
    logger.error('Error al obtener puestos para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un puesto de trabajo por ID
 */
export async function getJobPositionById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-positions', 'view', { redirect: true });

  try {
    const jobPosition = await prisma.jobPosition.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!jobPosition) {
      throw new Error('Puesto de trabajo no encontrado');
    }

    return jobPosition;
  } catch (error) {
    logger.error('Error al obtener puesto de trabajo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo puesto de trabajo
 */
export async function createJobPosition(input: CreateJobPositionInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-positions', 'create', { redirect: true });

  try {
    const jobPosition = await prisma.jobPosition.create({
      data: {
        name: input.name,
        description: input.description,
        companyId,
      },
    });

    logger.info('Puesto de trabajo creado', { data: { id: jobPosition.id, companyId } });
    revalidatePath('/dashboard/company/job-positions');

    return jobPosition;
  } catch (error) {
    logger.error('Error al crear puesto de trabajo', { data: { error, companyId } });
    throw new Error('Error al crear puesto de trabajo');
  }
}

/**
 * Actualiza un puesto de trabajo
 */
export async function updateJobPosition(id: string, input: UpdateJobPositionInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-positions', 'update', { redirect: true });

  try {
    const existing = await prisma.jobPosition.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Puesto de trabajo no encontrado');
    }

    const jobPosition = await prisma.jobPosition.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
      },
    });

    logger.info('Puesto de trabajo actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/job-positions');

    return jobPosition;
  } catch (error) {
    logger.error('Error al actualizar puesto de trabajo', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un puesto de trabajo (soft delete)
 */
export async function deleteJobPosition(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-positions', 'delete', { redirect: true });

  try {
    const existing = await prisma.jobPosition.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Puesto de trabajo no encontrado');
    }

    await prisma.jobPosition.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Puesto de trabajo eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/job-positions');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar puesto de trabajo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type JobPositionListItem = Awaited<ReturnType<typeof getJobPositionsPaginated>>['data'][number];
export type JobPosition = Awaited<ReturnType<typeof getJobPositionById>>;
export type JobPositionOption = Awaited<ReturnType<typeof getJobPositionsForSelect>>[number];
