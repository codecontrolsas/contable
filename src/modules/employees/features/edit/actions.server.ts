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
import { getPresignedDownloadUrl } from '@/shared/lib/storage';
import { revalidatePath } from 'next/cache';

// Select optimizado para relaciones - solo id y name
const relationSelect = { select: { id: true, name: true } } as const;

// ============================================
// TIPOS
// ============================================

export interface UpdateEmployeeInput {
  // Identificación
  employeeNumber?: string;
  identityDocumentType?: IdentityDocumentType;
  documentNumber?: string;
  cuil?: string;

  // Datos Personales
  firstName?: string;
  lastName?: string;
  birthDate?: Date | null;
  gender?: Gender | null;
  maritalStatus?: MaritalStatus | null;
  educationLevel?: EducationLevel | null;
  nationalityId?: number | null;
  pictureUrl?: string | null;
  pictureKey?: string | null;

  // Contacto
  phone?: string;
  email?: string | null;

  // Dirección
  street?: string;
  streetNumber?: string;
  postalCode?: string | null;
  provinceId?: number;
  cityId?: number | null;
  birthPlaceId?: number | null;

  // Información Laboral
  hireDate?: Date;
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
 * Obtiene un empleado por ID para edición (incluye relaciones necesarias)
 * Optimizado: solo trae los campos necesarios de las relaciones
 */
export async function getEmployeeForEdit(id: string) {
  await checkPermission('employees', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        nationality: relationSelect,
        province: relationSelect,
        city: relationSelect,
        jobPosition: relationSelect,
        contractType: relationSelect,
        costCenter: relationSelect,
        jobCategory: {
          select: {
            id: true,
            name: true,
            agreement: {
              select: {
                id: true,
                name: true,
                union: relationSelect,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new Error('Empleado no encontrado');
    }

    // Generar URL de foto dinámicamente si existe pictureKey
    let pictureUrl = employee.pictureUrl;
    if (employee.pictureKey) {
      try {
        pictureUrl = await getPresignedDownloadUrl(employee.pictureKey, { expiresIn: 3600 });
      } catch (e) {
        logger.warn('No se pudo generar URL de foto para edición', { data: { key: employee.pictureKey } });
      }
    }

    return {
      ...employee,
      pictureUrl,
    };
  } catch (error) {
    logger.error('Error al obtener empleado para edición', { data: { error, id } });
    throw error;
  }
}

export type EmployeeForEdit = Awaited<ReturnType<typeof getEmployeeForEdit>>;

// ============================================
// MUTATIONS
// ============================================

/**
 * Actualiza un empleado existente
 */
export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  await checkPermission('employees', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el empleado existe y pertenece a la empresa
    const existing = await prisma.employee.findFirst({
      where: {
        id,
        companyId,
      },
      select: { employeeNumber: true, cuil: true },
    });

    if (!existing) {
      throw new Error('Empleado no encontrado');
    }

    const cleanedInput = {
      ...input,
      jobPositionId: cleanUUID(input.jobPositionId),
      contractTypeId: cleanUUID(input.contractTypeId),
      jobCategoryId: cleanUUID(input.jobCategoryId),
      costCenterId: cleanUUID(input.costCenterId),
    };

    // Verificar legajo único si se está cambiando
    if (cleanedInput.employeeNumber && cleanedInput.employeeNumber !== existing.employeeNumber) {
      const existingByNumber = await prisma.employee.findFirst({
        where: {
          companyId,
          employeeNumber: cleanedInput.employeeNumber,
          id: { not: id },
        },
        select: { id: true },
      });

      if (existingByNumber) {
        throw new Error('Ya existe un empleado con ese número de legajo');
      }
    }

    // Verificar CUIL único si se está cambiando
    if (cleanedInput.cuil && cleanedInput.cuil !== existing.cuil) {
      const existingByCuil = await prisma.employee.findFirst({
        where: {
          companyId,
          cuil: cleanedInput.cuil,
          id: { not: id },
        },
        select: { id: true },
      });

      if (existingByCuil) {
        throw new Error('Ya existe un empleado con ese CUIL');
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: cleanedInput,
      select: { id: true },
    });

    logger.info('Empleado actualizado', { data: { id: employee.id, companyId } });
    revalidatePath('/dashboard/employees');
    revalidatePath(`/dashboard/employees/${id}`);

    return employee;
  } catch (error) {
    logger.error('Error al actualizar empleado', { data: { error, id, companyId } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al actualizar empleado');
  }
}
