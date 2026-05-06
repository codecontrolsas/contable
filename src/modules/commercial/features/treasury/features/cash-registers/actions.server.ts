'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cashRegisterSchema, type CashRegisterFormData } from '../../shared/validators';
import { checkPermission } from '@/shared/lib/permissions';

/**
 * Crea una nueva caja
 */
export async function createCashRegister(data: CashRegisterFormData) {
  await checkPermission('commercial.treasury.cash-registers', 'create', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Validar datos
    const validated = cashRegisterSchema.parse(data);

    // Verificar código duplicado
    const existing = await prisma.cashRegister.findFirst({
      where: {
        companyId,
        code: validated.code,
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error('Ya existe una caja con ese código');
    }

    // Si se marca como default, desmarcar otras
    if (validated.isDefault) {
      await prisma.cashRegister.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Crear caja
    const cashRegister = await prisma.cashRegister.create({
      data: {
        ...validated,
        companyId,
        createdBy: userId,
      },
    });

    logger.info('Caja creada', {
      data: { cashRegisterId: cashRegister.id, code: cashRegister.code },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true, id: cashRegister.id };
  } catch (error) {
    logger.error('Error al crear caja', { data: { error } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al crear caja');
  }
}

/**
 * Actualiza una caja existente
 */
export async function updateCashRegister(id: string, data: CashRegisterFormData) {
  await checkPermission('commercial.treasury.cash-registers', 'update', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Validar datos
    const validated = cashRegisterSchema.parse(data);

    // Verificar que la caja existe y pertenece a la empresa
    const existing = await prisma.cashRegister.findFirst({
      where: { id, companyId },
      select: { id: true, code: true },
    });

    if (!existing) {
      throw new Error('Caja no encontrada');
    }

    // Verificar código duplicado (excluyendo la caja actual)
    if (validated.code !== existing.code) {
      const duplicate = await prisma.cashRegister.findFirst({
        where: {
          companyId,
          code: validated.code,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new Error('Ya existe una caja con ese código');
      }
    }

    // Si se marca como default, desmarcar otras
    if (validated.isDefault) {
      await prisma.cashRegister.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Actualizar caja
    const cashRegister = await prisma.cashRegister.update({
      where: { id },
      data: validated,
    });

    logger.info('Caja actualizada', {
      data: { cashRegisterId: cashRegister.id, code: cashRegister.code },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true, id: cashRegister.id };
  } catch (error) {
    logger.error('Error al actualizar caja', { data: { error, id } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al actualizar caja');
  }
}

/**
 * Desactiva una caja (no se puede eliminar si tiene sesiones)
 */
export async function deactivateCashRegister(id: string) {
  await checkPermission('commercial.treasury.cash-registers', 'update', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que la caja existe y pertenece a la empresa
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        code: true,
        sessions: {
          where: { status: 'OPEN' },
          select: { id: true },
        },
      },
    });

    if (!cashRegister) {
      throw new Error('Caja no encontrada');
    }

    // No se puede desactivar si tiene sesión abierta
    if (cashRegister.sessions.length > 0) {
      throw new Error('No se puede desactivar una caja con sesión abierta');
    }

    // Desactivar caja
    await prisma.cashRegister.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    logger.info('Caja desactivada', {
      data: { cashRegisterId: id, code: cashRegister.code },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true };
  } catch (error) {
    logger.error('Error al desactivar caja', { data: { error, id } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al desactivar caja');
  }
}

/**
 * Activa una caja desactivada
 */
export async function activateCashRegister(id: string) {
  await checkPermission('commercial.treasury.cash-registers', 'update', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que la caja existe y pertenece a la empresa
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id, companyId },
      select: { id: true, code: true },
    });

    if (!cashRegister) {
      throw new Error('Caja no encontrada');
    }

    // Activar caja
    await prisma.cashRegister.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    logger.info('Caja activada', {
      data: { cashRegisterId: id, code: cashRegister.code },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true };
  } catch (error) {
    logger.error('Error al activar caja', { data: { error, id } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al activar caja');
  }
}
