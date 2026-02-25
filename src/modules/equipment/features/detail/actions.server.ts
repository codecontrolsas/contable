'use server';

import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { getVehicleStatusInfo } from '@/shared/lib/vehicleStatus';
import type { VehicleStatusInfo } from '@/shared/lib/vehicleStatus.types';

// Select optimizado para relaciones - solo id y name
const relationSelect = { select: { id: true, name: true } } as const;

/**
 * Obtiene un vehículo por su ID con todas sus relaciones
 * Optimizado: solo trae los campos necesarios de las relaciones
 */
export async function getVehicleById(id: string) {
  await checkPermission('equipment', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        brand: relationSelect,
        model: relationSelect,
        type: relationSelect,
        typeOfVehicle: relationSelect,
        costCenter: relationSelect,
        sector: relationSelect,
        typeOperative: relationSelect,
        contractorAllocations: {
          select: {
            id: true,
            contractor: { select: { id: true, name: true, taxId: true } },
          },
        },
        owner: { select: { id: true, name: true, cuit: true } },
      },
    });

    if (!vehicle) {
      throw new Error('Vehículo no encontrado');
    }

    if (vehicle.companyId !== companyId) {
      throw new Error('No tienes permiso para ver este vehículo');
    }

    return vehicle;
  } catch (error) {
    logger.error('Error getting vehicle by id', { data: { error, id } });
    throw error instanceof Error ? error : new Error('Error al obtener el vehículo');
  }
}

/**
 * Obtiene la información del estado de documentos de un vehículo (para tooltip)
 */
export async function getVehicleDocumentStatusInfo(vehicleId: string): Promise<VehicleStatusInfo> {
  await checkPermission('equipment', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  return getVehicleStatusInfo(vehicleId, companyId);
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type VehicleDetail = Awaited<ReturnType<typeof getVehicleById>>;
