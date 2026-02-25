'use server';

import type { EmployeeStatus } from '@/generated/prisma/enums';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildFiltersWhere,
  buildSearchWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';

// ============================================
// TIPOS
// ============================================

export interface EmployeeFilters {
  search?: string;
  status?: EmployeeStatus;
  jobPositionId?: string;
  contractTypeId?: string;
  isActive?: boolean;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene empleados con paginación server-side para DataTable
 */
export async function getEmployeesPaginated(searchParams: DataTableSearchParams) {
  await checkPermission('employees', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, [
      'firstName',
      'lastName',
      'employeeNumber',
      'documentNumber',
      'cuil',
    ]);

    // Construir cláusula de filtros
    const filtersWhere = buildFiltersWhere(state.filters, {
      status: 'status',
      jobPosition: 'jobPositionId',
      contractType: 'contractTypeId',
    });

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
      ...filtersWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          documentNumber: true,
          identityDocumentType: true,
          cuil: true,
          status: true,
          pictureUrl: true,
          jobPosition: {
            select: { id: true, name: true },
          },
          contractType: {
            select: { id: true, name: true },
          },
          jobCategory: {
            select: {
              id: true,
              name: true,
              agreement: {
                select: {
                  name: true,
                  union: { select: { name: true } },
                },
              },
            },
          },
          costCenter: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener empleados paginados', { data: { error, companyId } });
    throw new Error('Error al obtener empleados');
  }
}

/**
 * Obtiene todos los empleados de la empresa activa (sin paginación)
 * @deprecated Usar getEmployeesPaginated para listas grandes
 */
export async function getAllEmployees(filters?: EmployeeFilters) {
  await checkPermission('employees', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        isActive: filters?.isActive ?? true,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.jobPositionId && { jobPositionId: filters.jobPositionId }),
        ...(filters?.contractTypeId && { contractTypeId: filters.contractTypeId }),
        ...(filters?.search && {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { employeeNumber: { contains: filters.search, mode: 'insensitive' } },
            { documentNumber: { contains: filters.search, mode: 'insensitive' } },
            { cuil: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        jobPosition: {
          select: { id: true, name: true },
        },
        contractType: {
          select: { id: true, name: true },
        },
        jobCategory: {
          select: {
            id: true,
            name: true,
            agreement: {
              select: {
                name: true,
                union: { select: { name: true } },
              },
            },
          },
        },
        costCenter: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return employees;
  } catch (error) {
    logger.error('Error al obtener empleados', { data: { error, companyId } });
    throw new Error('Error al obtener empleados');
  }
}

/**
 * Obtiene empleados para select (solo id y nombre)
 */
export async function getEmployeesForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return employees.map((e) => ({
      id: e.id,
      name: `${e.lastName}, ${e.firstName}`,
      employeeNumber: e.employeeNumber,
    }));
  } catch (error) {
    logger.error('Error al obtener empleados para select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene puestos de trabajo para filtros
 */
export async function getJobPositionsForFilter() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.jobPosition.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener puestos para filtro', { data: { error } });
    return [];
  }
}

/**
 * Obtiene tipos de contrato para filtros
 */
export async function getContractTypesForFilter() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.contractType.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener tipos de contrato para filtro', { data: { error } });
    return [];
  }
}

/**
 * Elimina un empleado permanentemente
 */
export async function deleteEmployee(id: string) {
  await checkPermission('employees', 'delete', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const existing = await prisma.employee.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Empleado no encontrado');
    }

    await prisma.employee.delete({
      where: { id },
    });

    logger.info('Empleado eliminado permanentemente', { data: { id, companyId } });
    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar empleado', { data: { error, id } });
    throw error;
  }
}

// ============================================
// EXPORT
// ============================================

/**
 * Obtiene TODOS los empleados con los filtros actuales (para exportar a Excel)
 * Usa los mismos filtros que getEmployeesPaginated pero sin paginación
 */
export async function getAllEmployeesForExport(searchParams: DataTableSearchParams) {
  await checkPermission('employees', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const state = parseSearchParams(searchParams);

    const searchWhere = buildSearchWhere(state.search, [
      'firstName',
      'lastName',
      'employeeNumber',
      'documentNumber',
      'cuil',
    ]);

    const filtersWhere = buildFiltersWhere(state.filters, {
      status: 'status',
      jobPosition: 'jobPositionId',
      contractType: 'contractTypeId',
    });

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
      ...filtersWhere,
    };

    // SIN skip/take para obtener todos
    return await prisma.employee.findMany({
      where,
      orderBy: state.sortBy
        ? { [state.sortBy]: state.sortOrder }
        : [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        jobPosition: { select: { id: true, name: true } },
        contractType: { select: { id: true, name: true } },
        jobCategory: {
          select: {
            id: true,
            name: true,
            agreement: {
              select: {
                name: true,
                union: { select: { name: true } },
              },
            },
          },
        },
        costCenter: { select: { id: true, name: true } },
      },
    });
  } catch (error) {
    logger.error('Error al obtener empleados para exportar', { data: { error } });
    throw new Error('Error al obtener empleados para exportar');
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type EmployeeListItem = Awaited<ReturnType<typeof getEmployeesPaginated>>['data'][number];
export type EmployeeOption = Awaited<ReturnType<typeof getEmployeesForSelect>>[number];
export type JobPositionOption = Awaited<ReturnType<typeof getJobPositionsForFilter>>[number];
export type ContractTypeOption = Awaited<ReturnType<typeof getContractTypesForFilter>>[number];
