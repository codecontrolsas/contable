'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import { createPointOfSaleSchema } from '../shared/validators';
import { revalidatePath } from 'next/cache';

// Obtener todos los puntos de venta de la empresa
export async function getPointsOfSale() {
  await checkPermission('commercial.points-of-sale', 'view', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const pointsOfSale = await prisma.salesPointOfSale.findMany({
      where: {
        companyId,
      },
      orderBy: [
        { number: 'asc' },
      ],
      select: {
        id: true,
        number: true,
        name: true,
        isActive: true,
        afipEnabled: true,
        _count: {
          select: {
            salesInvoices: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return pointsOfSale;
  } catch (error) {
    logger.error('Error al obtener puntos de venta', {
      data: { companyId, error },
    });
    throw new Error('Error al obtener los puntos de venta');
  }
}

// Obtener un punto de venta por ID
export async function getPointOfSaleById(id: string) {
  await checkPermission('commercial.points-of-sale', 'view', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');
  const userId = authUserId; // Para usar en el resto de la función

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const pointOfSale = await prisma.salesPointOfSale.findFirst({
      where: {
        id: id,
        companyId: companyId,
      },
      select: {
        id: true,
        number: true,
        name: true,
        isActive: true,
        afipEnabled: true,
        _count: {
          select: {
            salesInvoices: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!pointOfSale) {
      throw new Error('Punto de venta no encontrado');
    }

    return pointOfSale;
  } catch (error) {
    logger.error('Error al obtener punto de venta', {
      data: { id, companyId, error },
    });
    throw new Error('Error al obtener el punto de venta');
  }
}

// Crear un nuevo punto de venta
export async function createPointOfSale(data: unknown) {
  await checkPermission('commercial.points-of-sale', 'create', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');
  const userId = authUserId; // Para usar en el resto de la función

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Validar datos
    const validatedData = createPointOfSaleSchema.parse(data);

    // Verificar que no exista otro punto de venta con el mismo número
    const existing = await prisma.salesPointOfSale.findUnique({
      where: {
        companyId_number: {
          companyId,
          number: validatedData.number,
        },
      },
    });

    if (existing) {
      throw new Error('Ya existe un punto de venta con ese número');
    }

    // Crear punto de venta
    const pointOfSale = await prisma.salesPointOfSale.create({
      data: {
        companyId,
        number: validatedData.number,
        name: validatedData.name,
        isActive: validatedData.isActive,
        afipEnabled: validatedData.afipEnabled,
        createdBy: userId,
      },
    });

    logger.info('Punto de venta creado', {
      data: {
        pointOfSaleId: pointOfSale.id,
        number: pointOfSale.number,
        companyId,
        userId,
      },
    });

    revalidatePath('/dashboard/commercial/points-of-sale');
    return pointOfSale;
  } catch (error) {
    logger.error('Error al crear punto de venta', {
      data: { companyId, error },
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Error al crear el punto de venta');
  }
}

// Actualizar un punto de venta
export async function updatePointOfSale(id: string, data: unknown) {
  await checkPermission('commercial.points-of-sale', 'update', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');
  const userId = authUserId; // Para usar en el resto de la función

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Validar datos
    const validatedData = createPointOfSaleSchema.parse(data);

    // Verificar que el punto de venta existe y pertenece a la empresa
    const existing = await prisma.salesPointOfSale.findFirst({
      where: {
        id: id,
        companyId: companyId,
      },
    });

    if (!existing) {
      throw new Error('Punto de venta no encontrado');
    }

    // Verificar que no exista otro punto de venta con el mismo número
    const duplicate = await prisma.salesPointOfSale.findFirst({
      where: {
        companyId,
        number: validatedData.number,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new Error('Ya existe otro punto de venta con ese número');
    }

    // Actualizar punto de venta
    const pointOfSale = await prisma.salesPointOfSale.update({
      where: { id },
      data: {
        number: validatedData.number,
        name: validatedData.name,
        isActive: validatedData.isActive,
        afipEnabled: validatedData.afipEnabled,
      },
    });

    logger.info('Punto de venta actualizado', {
      data: {
        pointOfSaleId: pointOfSale.id,
        number: pointOfSale.number,
        companyId,
        userId,
      },
    });

    revalidatePath('/dashboard/commercial/points-of-sale');
    revalidatePath(`/dashboard/commercial/points-of-sale/${id}/edit`);
    return pointOfSale;
  } catch (error) {
    logger.error('Error al actualizar punto de venta', {
      data: { id, companyId, error },
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Error al actualizar el punto de venta');
  }
}

// Eliminar un punto de venta
export async function deletePointOfSale(id: string) {
  await checkPermission('commercial.points-of-sale', 'delete', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');
  const userId = authUserId; // Para usar en el resto de la función

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el punto de venta existe y pertenece a la empresa
    const existing = await prisma.salesPointOfSale.findFirst({
      where: {
        id: id,
        companyId: companyId,
      },
    });

    if (!existing) {
      throw new Error('Punto de venta no encontrado');
    }

    // Verificar que no tenga facturas asociadas
    const invoiceCount = await prisma.salesInvoice.count({
      where: {
        pointOfSaleId: id,
      },
    });

    if (invoiceCount > 0) {
      throw new Error(
        `No se puede eliminar el punto de venta porque tiene ${invoiceCount} factura(s) asociada(s)`
      );
    }

    // Eliminar punto de venta
    await prisma.salesPointOfSale.delete({
      where: { id },
    });

    logger.info('Punto de venta eliminado', {
      data: {
        pointOfSaleId: id,
        number: existing.number,
        companyId,
        userId,
      },
    });

    revalidatePath('/dashboard/commercial/points-of-sale');
  } catch (error) {
    logger.error('Error al eliminar punto de venta', {
      data: { id, companyId, error },
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Error al eliminar el punto de venta');
  }
}

// Alternar estado activo de un punto de venta
export async function togglePointOfSaleStatus(id: string) {
  await checkPermission('commercial.points-of-sale', 'update', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');
  const userId = authUserId; // Para usar en el resto de la función

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Obtener punto de venta actual
    const existing = await prisma.salesPointOfSale.findFirst({
      where: {
        id: id,
        companyId: companyId,
      },
    });

    if (!existing) {
      throw new Error('Punto de venta no encontrado');
    }

    // Actualizar estado
    const pointOfSale = await prisma.salesPointOfSale.update({
      where: { id },
      data: {
        isActive: !existing.isActive,
      },
    });

    logger.info('Estado de punto de venta actualizado', {
      data: {
        pointOfSaleId: pointOfSale.id,
        number: pointOfSale.number,
        newStatus: pointOfSale.isActive,
        companyId,
        userId,
      },
    });

    revalidatePath('/dashboard/commercial/points-of-sale');
    return pointOfSale;
  } catch (error) {
    logger.error('Error al cambiar estado de punto de venta', {
      data: { id, companyId, error },
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Error al cambiar el estado del punto de venta');
  }
}
