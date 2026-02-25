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
import type { CustomerTaxCondition } from '@/generated/prisma/enums';

// ============================================
// TIPOS
// ============================================

export interface CreateContractorInput {
  name: string;
  taxId?: string;
  taxCondition: CustomerTaxCondition;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateContractorInput {
  name?: string;
  taxId?: string;
  taxCondition?: CustomerTaxCondition;
  email?: string;
  phone?: string;
  address?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene contratistas con paginación server-side para DataTable
 */
export async function getContractorsPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contractors', 'view', { redirect: true });

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, ['name', 'taxId', 'email']);

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.contractor.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
        include: {
          _count: {
            select: { vehicleAllocations: true },
          },
        },
      }),
      prisma.contractor.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener contratistas paginados', { data: { error, companyId } });
    throw new Error('Error al obtener contratistas');
  }
}

/**
 * Obtiene todos los contratistas de la empresa activa (sin paginación)
 * @deprecated Usar getContractorsPaginated para listas con DataTable
 */
export async function getAllContractors() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contractors', 'view', { redirect: true });

  try {
    return await prisma.contractor.findMany({
      where: { companyId, isActive: true },
      include: { _count: { select: { vehicleAllocations: true } } },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener contratistas', { data: { error } });
    throw new Error('Error al obtener contratistas');
  }
}

/**
 * Obtiene contratistas para select (solo id, nombre, CUIT y condición IVA)
 */
export async function getContractorsForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.contractor.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, taxId: true, taxCondition: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener contratistas para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un contratista por ID
 */
export async function getContractorById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contractors', 'view', { redirect: true });

  try {
    const contractor = await prisma.contractor.findFirst({
      where: { id, companyId },
    });

    if (!contractor) {
      throw new Error('Contratista no encontrado');
    }

    return contractor;
  } catch (error) {
    logger.error('Error al obtener contratista', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo contratista
 */
export async function createContractor(input: CreateContractorInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contractors', 'create', { redirect: true });

  try {
    const contractor = await prisma.contractor.create({
      data: {
        name: input.name,
        taxId: input.taxId || null,
        taxCondition: input.taxCondition,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        companyId,
      },
    });

    logger.info('Contratista creado', { data: { id: contractor.id, companyId } });
    revalidatePath('/dashboard/company/contractors');

    return contractor;
  } catch (error) {
    logger.error('Error al crear contratista', { data: { error, companyId } });
    throw new Error('Error al crear contratista');
  }
}

/**
 * Actualiza un contratista
 */
export async function updateContractor(id: string, input: UpdateContractorInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contractors', 'update', { redirect: true });

  try {
    const existing = await prisma.contractor.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Contratista no encontrado');
    }

    const contractor = await prisma.contractor.update({
      where: { id },
      data: {
        name: input.name,
        taxId: input.taxId,
        taxCondition: input.taxCondition,
        email: input.email,
        phone: input.phone,
        address: input.address,
      },
    });

    logger.info('Contratista actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/contractors');

    return contractor;
  } catch (error) {
    logger.error('Error al actualizar contratista', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un contratista (soft delete)
 */
export async function deleteContractor(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contractors', 'delete', { redirect: true });

  try {
    const existing = await prisma.contractor.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Contratista no encontrado');
    }

    await prisma.contractor.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Contratista eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/contractors');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar contratista', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type ContractorListItem = Awaited<ReturnType<typeof getContractorsPaginated>>['data'][number];
export type Contractor = Awaited<ReturnType<typeof getContractorById>>;
export type ContractorSelectItem = Awaited<ReturnType<typeof getContractorsForSelect>>[number];
