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

export interface CreateCollectiveAgreementInput {
  name: string;
  unionId: string;
}

export interface UpdateCollectiveAgreementInput {
  name?: string;
  unionId?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene convenios colectivos con paginación server-side para DataTable
 */
export async function getCollectiveAgreementsPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.collective-agreements', 'view', { redirect: true });

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, ['name']);

    const where = {
      isActive: true,
      union: {
        companyId,
        isActive: true,
      },
      ...searchWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.collectiveAgreement.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || [{ union: { name: 'asc' } }, { name: 'asc' }],
        include: {
          union: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: { jobCategories: true },
          },
        },
      }),
      prisma.collectiveAgreement.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener convenios colectivos paginados', { data: { error, companyId } });
    throw new Error('Error al obtener convenios colectivos');
  }
}

/**
 * Obtiene todos los convenios colectivos de la empresa activa (sin paginación)
 * @deprecated Usar getCollectiveAgreementsPaginated para listas con DataTable
 */
export async function getAllCollectiveAgreements() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.collective-agreements', 'view', { redirect: true });

  try {
    const agreements = await prisma.collectiveAgreement.findMany({
      where: {
        isActive: true,
        union: {
          companyId,
          isActive: true,
        },
      },
      include: {
        union: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { jobCategories: true },
        },
      },
      orderBy: [{ union: { name: 'asc' } }, { name: 'asc' }],
    });

    return agreements;
  } catch (error) {
    logger.error('Error al obtener convenios colectivos', { data: { error, companyId } });
    throw new Error('Error al obtener convenios colectivos');
  }
}

/**
 * Obtiene convenios colectivos para select (solo id y nombre)
 */
export async function getCollectiveAgreementsForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const agreements = await prisma.collectiveAgreement.findMany({
      where: {
        isActive: true,
        union: {
          companyId,
          isActive: true,
        },
      },
      select: {
        id: true,
        name: true,
        union: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ union: { name: 'asc' } }, { name: 'asc' }],
    });

    return agreements;
  } catch (error) {
    logger.error('Error al obtener convenios para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene convenios colectivos por sindicato
 */
export async function getCollectiveAgreementsByUnion(unionId: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const agreements = await prisma.collectiveAgreement.findMany({
      where: {
        unionId,
        isActive: true,
        union: {
          companyId,
          isActive: true,
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return agreements;
  } catch (error) {
    logger.error('Error al obtener convenios por sindicato', { data: { error, unionId } });
    return [];
  }
}

/**
 * Obtiene un convenio colectivo por ID
 */
export async function getCollectiveAgreementById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.collective-agreements', 'view', { redirect: true });

  try {
    const agreement = await prisma.collectiveAgreement.findFirst({
      where: {
        id,
        union: {
          companyId,
        },
      },
      include: {
        union: {
          select: {
            id: true,
            name: true,
          },
        },
        jobCategories: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!agreement) {
      throw new Error('Convenio colectivo no encontrado');
    }

    return agreement;
  } catch (error) {
    logger.error('Error al obtener convenio colectivo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo convenio colectivo
 */
export async function createCollectiveAgreement(input: CreateCollectiveAgreementInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.collective-agreements', 'create', { redirect: true });

  try {
    // Verificar que el sindicato pertenezca a la empresa
    const union = await prisma.union.findFirst({
      where: {
        id: input.unionId,
        companyId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!union) {
      throw new Error('Sindicato no encontrado');
    }

    const agreement = await prisma.collectiveAgreement.create({
      data: {
        name: input.name,
        unionId: input.unionId,
      },
      select: { id: true },
    });

    logger.info('Convenio colectivo creado', { data: { id: agreement.id, companyId } });
    revalidatePath('/dashboard/company/collective-agreements');

    return agreement;
  } catch (error) {
    logger.error('Error al crear convenio colectivo', { data: { error, companyId } });
    throw new Error('Error al crear convenio colectivo');
  }
}

/**
 * Actualiza un convenio colectivo
 */
export async function updateCollectiveAgreement(id: string, input: UpdateCollectiveAgreementInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.collective-agreements', 'update', { redirect: true });

  try {
    const existing = await prisma.collectiveAgreement.findFirst({
      where: {
        id,
        union: {
          companyId,
        },
      },
      select: { id: true, unionId: true },
    });

    if (!existing) {
      throw new Error('Convenio colectivo no encontrado');
    }

    // Si se cambia el sindicato, verificar que pertenezca a la empresa
    if (input.unionId && input.unionId !== existing.unionId) {
      const union = await prisma.union.findFirst({
        where: {
          id: input.unionId,
          companyId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!union) {
        throw new Error('Sindicato no encontrado');
      }
    }

    const agreement = await prisma.collectiveAgreement.update({
      where: { id },
      data: {
        name: input.name,
        unionId: input.unionId,
      },
      select: { id: true },
    });

    logger.info('Convenio colectivo actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/collective-agreements');

    return agreement;
  } catch (error) {
    logger.error('Error al actualizar convenio colectivo', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un convenio colectivo (soft delete)
 */
export async function deleteCollectiveAgreement(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.collective-agreements', 'delete', { redirect: true });

  try {
    const existing = await prisma.collectiveAgreement.findFirst({
      where: {
        id,
        union: {
          companyId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Convenio colectivo no encontrado');
    }

    await prisma.collectiveAgreement.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Convenio colectivo eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/collective-agreements');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar convenio colectivo', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CollectiveAgreementListItem = Awaited<ReturnType<typeof getCollectiveAgreementsPaginated>>['data'][number];
export type CollectiveAgreementOption = Awaited<ReturnType<typeof getCollectiveAgreementsForSelect>>[number];
export type CollectiveAgreement = Awaited<ReturnType<typeof getCollectiveAgreementById>>;
