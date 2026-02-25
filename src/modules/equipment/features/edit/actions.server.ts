'use server';

import type {
  CostType,
  Currency,
  VehicleCondition,
  VehicleTitularityType,
  VehicleStatus,
} from '@/generated/prisma/enums';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface UpdateVehicleInput {
  // Identificación
  internNumber?: string;
  domain?: string;
  chassis?: string;
  engine: string;
  serie?: string;
  year: string;
  kilometer?: string;

  // Imagen
  pictureUrl?: string;
  pictureKey?: string;

  // Estado
  status?: VehicleStatus;
  condition?: VehicleCondition;

  // Titularidad
  titularityType?: VehicleTitularityType;
  ownerId?: string;
  contractNumber?: string;
  contractStartDate?: Date | string;
  contractExpirationDate?: Date | string;
  currency?: Currency;
  price?: number;
  monthlyPrice?: number;

  // Tipo de costo
  costType?: CostType;

  // Relaciones
  brandId?: string;
  modelId?: string;
  typeId: string;
  typeOfVehicleId: string;
  costCenterId?: string;
  sectorId?: string;
  typeOperativeId?: string;

  // Contratistas asignados
  contractorIds?: string[];
}

/**
 * Obtiene un vehículo para edición con sus datos de formulario
 */
export async function getVehicleForEdit(id: string) {
  await checkPermission('equipment', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        contractorAllocations: {
          select: { contractorId: true },
        },
      },
    });

    if (!vehicle) {
      throw new Error('Vehículo no encontrado');
    }

    if (vehicle.companyId !== companyId) {
      throw new Error('No tienes permiso para editar este vehículo');
    }

    return vehicle;
  } catch (error) {
    logger.error('Error getting vehicle for edit', { data: { error, id } });
    throw error instanceof Error ? error : new Error('Error al obtener el vehículo');
  }
}

// Tipo inferido
export type GetVehicleForEditType = Awaited<ReturnType<typeof getVehicleForEdit>>;

/**
 * Actualiza un vehículo/equipo
 */
export async function updateVehicle(id: string, input: UpdateVehicleInput) {
  await checkPermission('equipment', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el vehículo pertenece a la empresa
    const existing = await prisma.vehicle.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (!existing || existing.companyId !== companyId) {
      throw new Error('No tienes permiso para editar este vehículo');
    }

    // Actualizar el vehículo y sus asignaciones de contratistas
    const vehicle = await prisma.$transaction(async (tx) => {
      // Eliminar asignaciones anteriores
      await tx.contractorVehicle.deleteMany({
        where: { vehicleId: id },
      });

      // Actualizar vehículo con nuevas asignaciones
      return tx.vehicle.update({
        where: { id },
        data: {
          internNumber: input.internNumber || null,
          domain: input.domain || null,
          chassis: input.chassis || null,
          engine: input.engine,
          serie: input.serie || null,
          year: input.year,
          kilometer: input.kilometer || '0',
          pictureUrl: input.pictureUrl || null,
          pictureKey: input.pictureKey || null,
          status: input.status || 'INCOMPLETE',
          condition: input.condition || 'OPERATIVE',
          titularityType: input.titularityType || null,
          ownerId: input.ownerId || null,
          contractNumber: input.contractNumber || null,
          contractStartDate: input.contractStartDate ? new Date(input.contractStartDate) : null,
          contractExpirationDate: input.contractExpirationDate
            ? new Date(input.contractExpirationDate)
            : null,
          currency: input.currency || null,
          price: input.price || null,
          monthlyPrice: input.monthlyPrice || null,
          costType: input.costType || null,
          brandId: input.brandId || null,
          modelId: input.modelId || null,
          typeId: input.typeId,
          typeOfVehicleId: input.typeOfVehicleId,
          costCenterId: input.costCenterId || null,
          sectorId: input.sectorId || null,
          typeOperativeId: input.typeOperativeId || null,
          contractorAllocations: input.contractorIds?.length
            ? {
                create: input.contractorIds.map((contractorId) => ({
                  contractorId,
                })),
              }
            : undefined,
        },
        select: { id: true },
      });
    });

    revalidatePath('/dashboard/equipment');
    revalidatePath(`/dashboard/equipment/${id}`);
    return vehicle;
  } catch (error) {
    logger.error('Error updating vehicle', { data: { error, id, input } });
    throw error instanceof Error ? error : new Error('Error al actualizar el vehículo');
  }
}

// Tipo inferido
export type VehicleForEdit = Awaited<ReturnType<typeof getVehicleForEdit>>;
