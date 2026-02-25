'use server';

import { getActiveCompanyId } from '@/shared/lib/company';
import { getEmployeeStatusInfo } from '@/shared/lib/employeeStatus';
import type { EmployeeStatusInfo } from '@/shared/lib/employeeStatus.types';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { getPresignedDownloadUrl } from '@/shared/lib/storage';

// Select optimizado para relaciones - solo id y name
const relationSelect = { select: { id: true, name: true } } as const;

/**
 * Obtiene un empleado por ID con todas sus relaciones
 * Optimizado: solo trae los campos necesarios de las relaciones
 * Genera URL de foto dinámicamente si existe pictureKey
 */
export async function getEmployeeById(id: string) {
  await checkPermission('employees', 'view', { redirect: true });
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
        birthPlace: relationSelect,
        jobPosition: relationSelect,
        contractType: relationSelect,
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
        costCenter: relationSelect,
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
        logger.warn('No se pudo generar URL de foto', { data: { key: employee.pictureKey } });
      }
    }

    return {
      ...employee,
      pictureUrl,
    };
  } catch (error) {
    logger.error('Error al obtener empleado', { data: { error, id } });
    throw error;
  }
}

/**
 * Obtiene la información del estado de documentos de un empleado (para tooltip)
 */
export async function getEmployeeDocumentStatusInfo(employeeId: string): Promise<EmployeeStatusInfo> {
  await checkPermission('employees', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  return getEmployeeStatusInfo(employeeId, companyId);
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type Employee = Awaited<ReturnType<typeof getEmployeeById>>;
