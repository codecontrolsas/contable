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

export interface CreateContractTypeInput {
  name: string;
  code?: string;
  description?: string;
}

export interface UpdateContractTypeInput {
  name?: string;
  code?: string;
  description?: string;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene tipos de contrato con paginación server-side para DataTable
 */
export async function getContractTypesPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contract-types', 'view', { redirect: true });

  try {
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);
    const searchWhere = buildSearchWhere(state.search, ['name', 'code']);

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
    };

    const [data, total] = await Promise.all([
      prisma.contractType.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
      }),
      prisma.contractType.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener tipos de contrato paginados', { data: { error, companyId } });
    throw new Error('Error al obtener tipos de contrato');
  }
}

/**
 * Obtiene todos los tipos de contrato de la empresa activa
 * @deprecated Usar getContractTypesPaginated para listas con DataTable
 */
export async function getAllContractTypes() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contract-types', 'view', { redirect: true });

  try {
    const contractTypes = await prisma.contractType.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return contractTypes;
  } catch (error) {
    logger.error('Error al obtener tipos de contrato', { data: { error, companyId } });
    throw new Error('Error al obtener tipos de contrato');
  }
}

/**
 * Obtiene tipos de contrato para select (solo id, nombre y codigo)
 */
export async function getContractTypesForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const contractTypes = await prisma.contractType.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: 'asc' },
    });

    return contractTypes;
  } catch (error) {
    logger.error('Error al obtener tipos de contrato para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene un tipo de contrato por ID
 */
export async function getContractTypeById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contract-types', 'view', { redirect: true });

  try {
    const contractType = await prisma.contractType.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!contractType) {
      throw new Error('Tipo de contrato no encontrado');
    }

    return contractType;
  } catch (error) {
    logger.error('Error al obtener tipo de contrato', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo tipo de contrato
 */
export async function createContractType(input: CreateContractTypeInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contract-types', 'create', { redirect: true });

  try {
    const contractType = await prisma.contractType.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
        companyId,
      },
    });

    logger.info('Tipo de contrato creado', { data: { id: contractType.id, companyId } });
    revalidatePath('/dashboard/company/contract-types');

    return contractType;
  } catch (error) {
    logger.error('Error al crear tipo de contrato', { data: { error, companyId } });
    throw new Error('Error al crear tipo de contrato');
  }
}

/**
 * Actualiza un tipo de contrato
 */
export async function updateContractType(id: string, input: UpdateContractTypeInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contract-types', 'update', { redirect: true });

  try {
    const existing = await prisma.contractType.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Tipo de contrato no encontrado');
    }

    const contractType = await prisma.contractType.update({
      where: { id },
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
      },
    });

    logger.info('Tipo de contrato actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/contract-types');

    return contractType;
  } catch (error) {
    logger.error('Error al actualizar tipo de contrato', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un tipo de contrato (soft delete)
 */
export async function deleteContractType(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.contract-types', 'delete', { redirect: true });

  try {
    const existing = await prisma.contractType.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Tipo de contrato no encontrado');
    }

    await prisma.contractType.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Tipo de contrato eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/contract-types');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar tipo de contrato', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type ContractTypeListItem = Awaited<ReturnType<typeof getContractTypesPaginated>>['data'][number];
export type ContractType = Awaited<ReturnType<typeof getContractTypeById>>;
export type ContractTypeOption = Awaited<ReturnType<typeof getContractTypesForSelect>>[number];
