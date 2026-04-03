'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { buildFiltersWhere } from '@/shared/components/common/DataTable/helpers';

// ============================================================================
// VALIDATORS
// ============================================================================

const createEquivalenceSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  oemCode: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const updateEquivalenceSchema = createEquivalenceSchema.partial();

export type CreateEquivalenceInput = z.infer<typeof createEquivalenceSchema>;
export type UpdateEquivalenceInput = z.infer<typeof updateEquivalenceSchema>;

// ============================================================================
// QUERIES
// ============================================================================

interface GetEquivalencesParams {
  page?: number;
  pageSize?: number;
  filters?: Record<string, string[]>;
}

/**
 * Obtiene el listado de grupos de equivalencia con paginación
 */
export async function getEquivalencesPaginated(params: GetEquivalencesParams = {}) {
  await checkPermission('commercial.equivalences', 'view', { redirect: true });
  const { page = 1, pageSize = 10, filters = {} } = params;
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const filtersWhere = buildFiltersWhere(filters, {}, { exclude: ['name', 'oemCode'] });

    // Filtros de texto
    const nameFilter = filters['name']?.[0];
    const oemCodeFilter = filters['oemCode']?.[0];
    const textConditions: Record<string, unknown>[] = [];
    if (nameFilter) {
      textConditions.push({ name: { contains: nameFilter, mode: 'insensitive' as const } });
    }
    if (oemCodeFilter) {
      textConditions.push({ oemCode: { contains: oemCodeFilter, mode: 'insensitive' as const } });
    }
    const textWhere = textConditions.length > 0 ? { AND: textConditions } : {};

    const where = {
      companyId,
      ...filtersWhere,
      ...textWhere,
    };

    const [groups, total] = await Promise.all([
      prisma.productGroup.findMany({
        where,
        select: {
          id: true,
          name: true,
          oemCode: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.productGroup.count({ where }),
    ]);

    const data = groups.map((group) => ({
      id: group.id,
      name: group.name,
      oemCode: group.oemCode,
      notes: group.notes,
      productCount: group._count.products,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    logger.error('Error al obtener grupos de equivalencia', { data: { error } });
    throw new Error('Error al obtener grupos de equivalencia');
  }
}

/**
 * Obtiene un grupo de equivalencia por ID con todos sus productos
 */
export async function getEquivalenceById(id: string) {
  await checkPermission('commercial.equivalences', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const group = await prisma.productGroup.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        oemCode: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        products: {
          select: {
            id: true,
            code: true,
            name: true,
            brand: true,
            salePrice: true,
            costPrice: true,
            oemCode: true,
            auxiliaryCode: true,
            status: true,
            warehouseStocks: {
              select: { quantity: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!group) return null;

    // Encontrar el menor precio de venta para resaltar
    const products = group.products.map((p) => {
      const currentStock = p.warehouseStocks.reduce(
        (sum, ws) => sum + Number(ws.quantity),
        0,
      );
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        brand: p.brand,
        salePrice: Number(p.salePrice),
        costPrice: Number(p.costPrice),
        oemCode: p.oemCode,
        auxiliaryCode: p.auxiliaryCode,
        status: p.status,
        currentStock,
      };
    });

    const totalStock = products.reduce((sum, p) => sum + p.currentStock, 0);
    const activePrices = products
      .filter((p) => p.status === 'ACTIVE' && p.salePrice > 0)
      .map((p) => p.salePrice);
    const bestPrice = activePrices.length > 0 ? Math.min(...activePrices) : null;

    return {
      id: group.id,
      name: group.name,
      oemCode: group.oemCode,
      notes: group.notes,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      products,
      totalStock,
      bestPrice,
    };
  } catch (error) {
    logger.error('Error al obtener grupo de equivalencia', { data: { error, id } });
    throw new Error('Error al obtener grupo de equivalencia');
  }
}

/**
 * Obtiene grupos de equivalencia para selects (id + name)
 */
export async function getEquivalencesForSelect() {
  await checkPermission('commercial.equivalences', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return prisma.productGroup.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error al obtener grupos para select', { data: { error } });
    return [];
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Crea un nuevo grupo de equivalencia
 */
export async function createEquivalence(input: CreateEquivalenceInput) {
  await checkPermission('commercial.equivalences', 'create', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const data = createEquivalenceSchema.parse(input);

    const group = await prisma.productGroup.create({
      data: {
        companyId,
        name: data.name,
        oemCode: data.oemCode || null,
        notes: data.notes || null,
      },
      select: {
        id: true,
        name: true,
        oemCode: true,
        notes: true,
      },
    });

    logger.info('Grupo de equivalencia creado', {
      data: { groupId: group.id, name: group.name, companyId },
    });

    revalidatePath('/dashboard/commercial/equivalences');
    return group;
  } catch (error) {
    logger.error('Error al crear grupo de equivalencia', { data: { error, input } });
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      throw new Error('Ya existe un grupo con ese nombre');
    }
    if (error instanceof Error) throw error;
    throw new Error('Error al crear grupo de equivalencia');
  }
}

/**
 * Actualiza un grupo de equivalencia
 */
export async function updateEquivalence(id: string, input: UpdateEquivalenceInput) {
  await checkPermission('commercial.equivalences', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const data = updateEquivalenceSchema.parse(input);

    const existing = await prisma.productGroup.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new Error('Grupo no encontrado');

    const group = await prisma.productGroup.update({
      where: { id },
      data: {
        name: data.name,
        oemCode: data.oemCode ?? existing.oemCode,
        notes: data.notes ?? existing.notes,
      },
      select: {
        id: true,
        name: true,
        oemCode: true,
        notes: true,
      },
    });

    logger.info('Grupo de equivalencia actualizado', {
      data: { groupId: id, companyId },
    });

    revalidatePath('/dashboard/commercial/equivalences');
    return group;
  } catch (error) {
    logger.error('Error al actualizar grupo de equivalencia', { data: { error, id, input } });
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      throw new Error('Ya existe un grupo con ese nombre');
    }
    if (error instanceof Error) throw error;
    throw new Error('Error al actualizar grupo de equivalencia');
  }
}

/**
 * Elimina un grupo de equivalencia (desvincula productos, no los elimina)
 */
export async function deleteEquivalence(id: string) {
  await checkPermission('commercial.equivalences', 'delete', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const existing = await prisma.productGroup.findFirst({
      where: { id, companyId },
      select: { id: true, _count: { select: { products: true } } },
    });
    if (!existing) throw new Error('Grupo no encontrado');

    // Desvincular productos del grupo antes de eliminar
    if (existing._count.products > 0) {
      await prisma.product.updateMany({
        where: { productGroupId: id },
        data: { productGroupId: null },
      });
    }

    await prisma.productGroup.delete({ where: { id } });

    logger.info('Grupo de equivalencia eliminado', {
      data: { groupId: id, companyId, productsUnlinked: existing._count.products },
    });

    revalidatePath('/dashboard/commercial/equivalences');
  } catch (error) {
    logger.error('Error al eliminar grupo de equivalencia', { data: { error, id } });
    if (error instanceof Error) throw error;
    throw new Error('Error al eliminar grupo de equivalencia');
  }
}
