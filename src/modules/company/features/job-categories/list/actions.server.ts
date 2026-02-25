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

export interface CreateJobCategoryInput {
  name: string;
  agreementId: string;
}

export interface UpdateJobCategoryInput {
  name?: string;
  agreementId?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene categorías laborales con paginación server-side para DataTable
 */
export async function getJobCategoriesPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-categories', 'view', { redirect: true });

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, ['name']);

    const where = {
      isActive: true,
      agreement: {
        isActive: true,
        union: {
          companyId,
          isActive: true,
        },
      },
      ...searchWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.jobCategory.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || [{ agreement: { union: { name: 'asc' } } }, { agreement: { name: 'asc' } }, { name: 'asc' }],
        include: {
          agreement: {
            select: {
              id: true,
              name: true,
              union: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: { employees: true },
          },
        },
      }),
      prisma.jobCategory.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener categorías laborales paginadas', { data: { error, companyId } });
    throw new Error('Error al obtener categorías laborales');
  }
}

/**
 * Obtiene todas las categorías laborales de la empresa activa (sin paginación)
 * @deprecated Usar getJobCategoriesPaginated para listas con DataTable
 */
export async function getAllJobCategories() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-categories', 'view', { redirect: true });

  try {
    const categories = await prisma.jobCategory.findMany({
      where: {
        isActive: true,
        agreement: {
          isActive: true,
          union: {
            companyId,
            isActive: true,
          },
        },
      },
      include: {
        agreement: {
          select: {
            id: true,
            name: true,
            union: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: [{ agreement: { union: { name: 'asc' } } }, { agreement: { name: 'asc' } }, { name: 'asc' }],
    });

    return categories;
  } catch (error) {
    logger.error('Error al obtener categorías laborales', { data: { error, companyId } });
    throw new Error('Error al obtener categorías laborales');
  }
}

/**
 * Obtiene categorías laborales para select (solo id y nombre)
 */
export async function getJobCategoriesForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const categories = await prisma.jobCategory.findMany({
      where: {
        isActive: true,
        agreement: {
          isActive: true,
          union: {
            companyId,
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        agreement: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ agreement: { name: 'asc' } }, { name: 'asc' }],
    });

    return categories;
  } catch (error) {
    logger.error('Error al obtener categorías para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene categorías laborales por convenio colectivo
 */
export async function getJobCategoriesByAgreement(agreementId: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const categories = await prisma.jobCategory.findMany({
      where: {
        agreementId,
        isActive: true,
        agreement: {
          isActive: true,
          union: {
            companyId,
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return categories;
  } catch (error) {
    logger.error('Error al obtener categorías por convenio', { data: { error, agreementId } });
    return [];
  }
}

/**
 * Obtiene una categoría laboral por ID
 */
export async function getJobCategoryById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-categories', 'view', { redirect: true });

  try {
    const category = await prisma.jobCategory.findFirst({
      where: {
        id,
        agreement: {
          union: {
            companyId,
          },
        },
      },
      include: {
        agreement: {
          select: {
            id: true,
            name: true,
            union: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      throw new Error('Categoría laboral no encontrada');
    }

    return category;
  } catch (error) {
    logger.error('Error al obtener categoría laboral', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea una nueva categoría laboral
 */
export async function createJobCategory(input: CreateJobCategoryInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-categories', 'create', { redirect: true });

  try {
    // Verificar que el convenio pertenezca a la empresa
    const agreement = await prisma.collectiveAgreement.findFirst({
      where: {
        id: input.agreementId,
        isActive: true,
        union: {
          companyId,
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (!agreement) {
      throw new Error('Convenio colectivo no encontrado');
    }

    const category = await prisma.jobCategory.create({
      data: {
        name: input.name,
        agreementId: input.agreementId,
      },
      select: { id: true },
    });

    logger.info('Categoría laboral creada', { data: { id: category.id, companyId } });
    revalidatePath('/dashboard/company/job-categories');

    return category;
  } catch (error) {
    logger.error('Error al crear categoría laboral', { data: { error, companyId } });
    throw new Error('Error al crear categoría laboral');
  }
}

/**
 * Actualiza una categoría laboral
 */
export async function updateJobCategory(id: string, input: UpdateJobCategoryInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-categories', 'update', { redirect: true });

  try {
    const existing = await prisma.jobCategory.findFirst({
      where: {
        id,
        agreement: {
          union: {
            companyId,
          },
        },
      },
      select: { id: true, agreementId: true },
    });

    if (!existing) {
      throw new Error('Categoría laboral no encontrada');
    }

    // Si se cambia el convenio, verificar que pertenezca a la empresa
    if (input.agreementId && input.agreementId !== existing.agreementId) {
      const agreement = await prisma.collectiveAgreement.findFirst({
        where: {
          id: input.agreementId,
          isActive: true,
          union: {
            companyId,
            isActive: true,
          },
        },
        select: { id: true },
      });

      if (!agreement) {
        throw new Error('Convenio colectivo no encontrado');
      }
    }

    const category = await prisma.jobCategory.update({
      where: { id },
      data: {
        name: input.name,
        agreementId: input.agreementId,
      },
      select: { id: true },
    });

    logger.info('Categoría laboral actualizada', { data: { id, companyId } });
    revalidatePath('/dashboard/company/job-categories');

    return category;
  } catch (error) {
    logger.error('Error al actualizar categoría laboral', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina una categoría laboral (soft delete)
 */
export async function deleteJobCategory(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.job-categories', 'delete', { redirect: true });

  try {
    const existing = await prisma.jobCategory.findFirst({
      where: {
        id,
        agreement: {
          union: {
            companyId,
          },
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Categoría laboral no encontrada');
    }

    await prisma.jobCategory.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Categoría laboral eliminada', { data: { id, companyId } });
    revalidatePath('/dashboard/company/job-categories');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar categoría laboral', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type JobCategoryListItem = Awaited<ReturnType<typeof getJobCategoriesPaginated>>['data'][number];
export type JobCategory = Awaited<ReturnType<typeof getJobCategoryById>>;
export type JobCategoryOption = Awaited<ReturnType<typeof getJobCategoriesForSelect>>[number];
