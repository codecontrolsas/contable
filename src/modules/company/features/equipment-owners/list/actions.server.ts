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
import type { VehicleTitularityType } from '@/generated/prisma/enums';

// ============================================
// TIPOS
// ============================================

export interface CreateEquipmentOwnerInput {
  name: string;
  cuit: string;
  titularityTypes: VehicleTitularityType[];
}

export interface UpdateEquipmentOwnerInput {
  name?: string;
  cuit?: string;
  titularityTypes?: VehicleTitularityType[];
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene titulares con paginación server-side para DataTable
 */
export async function getEquipmentOwnersPaginated(searchParams: DataTableSearchParams) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.equipment-owners', 'view', { redirect: true });

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, ['name', 'cuit']);

    const where = {
      companyId,
      isActive: true,
      ...searchWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.equipmentOwner.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
        include: {
          titularityTypes: {
            select: { titularityType: true },
          },
          _count: {
            select: { vehicles: true },
          },
        },
      }),
      prisma.equipmentOwner.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener titulares paginados', { data: { error, companyId } });
    throw new Error('Error al obtener titulares');
  }
}

/**
 * Obtiene un titular por ID
 */
export async function getEquipmentOwnerById(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.equipment-owners', 'view', { redirect: true });

  try {
    const owner = await prisma.equipmentOwner.findFirst({
      where: { id, companyId },
      include: {
        titularityTypes: {
          select: { titularityType: true },
        },
      },
    });

    if (!owner) {
      throw new Error('Titular no encontrado');
    }

    return owner;
  } catch (error) {
    logger.error('Error al obtener titular', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo titular
 */
export async function createEquipmentOwner(input: CreateEquipmentOwnerInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.equipment-owners', 'create', { redirect: true });

  try {
    const owner = await prisma.equipmentOwner.create({
      data: {
        name: input.name,
        cuit: input.cuit,
        companyId,
        titularityTypes: {
          create: input.titularityTypes.map((type) => ({
            titularityType: type,
          })),
        },
      },
    });

    logger.info('Titular creado', { data: { id: owner.id, companyId } });
    revalidatePath('/dashboard/company/equipment-owners');

    return owner;
  } catch (error) {
    logger.error('Error al crear titular', { data: { error, companyId } });
    throw new Error('Error al crear titular');
  }
}

/**
 * Actualiza un titular
 */
export async function updateEquipmentOwner(id: string, input: UpdateEquipmentOwnerInput) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.equipment-owners', 'update', { redirect: true });

  try {
    const existing = await prisma.equipmentOwner.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new Error('Titular no encontrado');
    }

    // Usar transacción para actualizar titular y sus tipos de titularidad
    const owner = await prisma.$transaction(async (tx) => {
      // Si se envían tipos de titularidad, eliminar los existentes y crear los nuevos
      if (input.titularityTypes) {
        await tx.equipmentOwnerTitularityType.deleteMany({
          where: { ownerId: id },
        });
      }

      return tx.equipmentOwner.update({
        where: { id },
        data: {
          name: input.name,
          cuit: input.cuit,
          titularityTypes: input.titularityTypes
            ? {
                create: input.titularityTypes.map((type) => ({
                  titularityType: type,
                })),
              }
            : undefined,
        },
      });
    });

    logger.info('Titular actualizado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/equipment-owners');

    return owner;
  } catch (error) {
    logger.error('Error al actualizar titular', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un titular (soft delete)
 */
export async function deleteEquipmentOwner(id: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');
  await checkPermission('company.equipment-owners', 'delete', { redirect: true });

  try {
    const existing = await prisma.equipmentOwner.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { vehicles: true } },
      },
    });

    if (!existing) {
      throw new Error('Titular no encontrado');
    }

    // Verificar si tiene vehículos asignados
    if (existing._count.vehicles > 0) {
      throw new Error(
        `No se puede eliminar el titular porque tiene ${existing._count.vehicles} equipo(s) asignado(s)`
      );
    }

    await prisma.equipmentOwner.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Titular eliminado', { data: { id, companyId } });
    revalidatePath('/dashboard/company/equipment-owners');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar titular', { data: { error, id } });
    throw error;
  }
}

// ============================================
// SELECT QUERIES
// ============================================

/**
 * Obtiene titulares para select (con tipos de titularidad para filtrado)
 */
export async function getEquipmentOwnersForSelect() {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.equipmentOwner.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        cuit: true,
        titularityTypes: {
          select: { titularityType: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener titulares para select', { data: { error } });
    return [];
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type EquipmentOwnerListItem = Awaited<
  ReturnType<typeof getEquipmentOwnersPaginated>
>['data'][number];
export type EquipmentOwner = Awaited<ReturnType<typeof getEquipmentOwnerById>>;
export type EquipmentOwnerOption = Awaited<
  ReturnType<typeof getEquipmentOwnersForSelect>
>[number];
