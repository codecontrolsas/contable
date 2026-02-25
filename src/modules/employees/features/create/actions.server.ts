'use server';

import type {
  CostType,
  EducationLevel,
  Gender,
  IdentityDocumentType,
  MaritalStatus,
  UnionAffiliationStatus,
} from '@/generated/prisma/enums';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { revalidatePath } from 'next/cache';

// ============================================
// TIPOS
// ============================================

export interface CreateEmployeeInput {
  // Identificación
  employeeNumber: string;
  identityDocumentType: IdentityDocumentType;
  documentNumber: string;
  cuil: string;

  // Datos Personales
  firstName: string;
  lastName: string;
  birthDate?: Date | null;
  gender?: Gender | null;
  maritalStatus?: MaritalStatus | null;
  educationLevel?: EducationLevel | null;
  nationalityId?: number | null;
  pictureUrl?: string | null;
  pictureKey?: string | null;

  // Contacto
  phone: string;
  email?: string | null;

  // Dirección
  street: string;
  streetNumber: string;
  postalCode?: string | null;
  provinceId: number;
  cityId?: number | null;
  birthPlaceId?: number | null;

  // Información Laboral
  hireDate: Date;
  workingHoursPerDay?: number | null;
  unionAffiliationStatus?: UnionAffiliationStatus | null;
  costType?: CostType | null;

  // Relaciones con catálogos
  jobPositionId?: string | null;
  contractTypeId?: string | null;
  jobCategoryId?: string | null;
  costCenterId?: string | null;
}

// ============================================
// HELPERS
// ============================================

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function cleanUUID(id: string | null | undefined): string | null {
  if (!id || id.trim() === '') return null;
  if (!isValidUUID(id)) {
    logger.warn('ID inválido descartado (no es UUID)', { data: { id } });
    return null;
  }
  return id;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene el siguiente número de legajo disponible
 */
export async function getNextEmployeeNumber(): Promise<string> {
  await checkPermission('employees', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const lastEmployee = await prisma.employee.findFirst({
      where: { companyId },
      orderBy: { employeeNumber: 'desc' },
      select: { employeeNumber: true },
    });

    if (!lastEmployee) {
      return '1';
    }

    const lastNumber = parseInt(lastEmployee.employeeNumber, 10);
    if (isNaN(lastNumber)) {
      return '1';
    }

    return String(lastNumber + 1);
  } catch (error) {
    logger.error('Error al obtener siguiente número de legajo', { data: { error } });
    return '1';
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo empleado
 */
export async function createEmployee(input: CreateEmployeeInput) {
  await checkPermission('employees', 'create', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const cleanedInput = {
      ...input,
      jobPositionId: cleanUUID(input.jobPositionId),
      contractTypeId: cleanUUID(input.contractTypeId),
      jobCategoryId: cleanUUID(input.jobCategoryId),
      costCenterId: cleanUUID(input.costCenterId),
    };

    // Verificar legajo único
    const existingByNumber = await prisma.employee.findFirst({
      where: {
        companyId,
        employeeNumber: cleanedInput.employeeNumber,
      },
      select: { id: true },
    });

    if (existingByNumber) {
      throw new Error('Ya existe un empleado con ese número de legajo');
    }

    // Verificar CUIL único
    const existingByCuil = await prisma.employee.findFirst({
      where: {
        companyId,
        cuil: cleanedInput.cuil,
      },
      select: { id: true },
    });

    if (existingByCuil) {
      throw new Error('Ya existe un empleado con ese CUIL');
    }

    const employee = await prisma.employee.create({
      data: {
        ...cleanedInput,
        companyId,
        status: 'INCOMPLETE',
      },
      select: { id: true },
    });

    logger.info('Empleado creado', { data: { id: employee.id, companyId } });
    revalidatePath('/dashboard/employees');

    return employee;
  } catch (error) {
    logger.error('Error al crear empleado', { data: { error, companyId } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al crear empleado');
  }
}
