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

export interface CreateVehicleInput {
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
 * Crea un nuevo vehículo/equipo
 */
export async function createVehicle(input: CreateVehicleInput) {
  await checkPermission('equipment', 'create', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        companyId,
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

    revalidatePath('/dashboard/equipment');
    return vehicle;
  } catch (error) {
    logger.error('Error creating vehicle', { data: { error, input } });
    throw new Error('Error al crear el vehículo');
  }
}

