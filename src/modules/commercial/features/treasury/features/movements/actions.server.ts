'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { cashMovementSchema, type CashMovementFormData } from '../../shared/validators';
import { checkPermission } from '@/shared/lib/permissions';

/**
 * Crea un nuevo movimiento de caja
 */
export async function createCashMovement(data: CashMovementFormData) {
  await checkPermission('commercial.treasury.cash-registers', 'create', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Validar datos
    const validated = cashMovementSchema.parse(data);

    // Verificar que la sesión existe y está abierta
    const session = await prisma.cashRegisterSession.findFirst({
      where: {
        id: validated.sessionId,
        companyId,
        status: 'OPEN',
      },
      select: {
        id: true,
        sessionNumber: true,
        expectedBalance: true,
        cashRegister: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Sesión no encontrada o ya cerrada');
    }

    const amount = new Prisma.Decimal(validated.amount);

    // Crear movimiento y actualizar saldo esperado en transacción
    const movement = await prisma.$transaction(async (tx) => {
      // Crear movimiento
      const newMovement = await tx.cashMovement.create({
        data: {
          cashRegisterId: validated.cashRegisterId,
          sessionId: validated.sessionId,
          companyId,
          type: validated.type,
          amount,
          description: validated.description,
          reference: validated.reference,
          date: validated.date,
          createdBy: userId,
        },
      });

      // Actualizar saldo esperado según el tipo de movimiento
      let newExpectedBalance = session.expectedBalance;

      if (validated.type === 'INCOME') {
        newExpectedBalance = session.expectedBalance.add(amount);
      } else if (validated.type === 'EXPENSE') {
        newExpectedBalance = session.expectedBalance.sub(amount);
      } else if (validated.type === 'ADJUSTMENT') {
        // El ajuste puede ser positivo o negativo
        // Por ahora lo dejamos como positivo, se puede mejorar
        newExpectedBalance = session.expectedBalance.add(amount);
      }

      // Actualizar sesión
      await tx.cashRegisterSession.update({
        where: { id: validated.sessionId },
        data: { expectedBalance: newExpectedBalance },
      });

      return newMovement;
    });

    logger.info('Movimiento de caja creado', {
      data: {
        movementId: movement.id,
        type: movement.type,
        amount: validated.amount,
        sessionNumber: session.sessionNumber,
        cashRegisterCode: session.cashRegister.code,
      },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true, id: movement.id };
  } catch (error) {
    logger.error('Error al crear movimiento de caja', { data: { error } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al crear movimiento de caja');
  }
}

/**
 * Obtiene los movimientos de una sesión
 */
export async function getSessionMovements(sessionId: string) {
  await checkPermission('commercial.treasury.cash-registers', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const movements = await prisma.cashMovement.findMany({
      where: {
        sessionId,
        companyId,
      },
      select: {
        id: true,
        type: true,
        date: true,
        amount: true,
        description: true,
        reference: true,
        createdBy: true,
        createdAt: true,
      },
      orderBy: { date: 'asc' },
    });

    return movements.map((m) => ({
      ...m,
      amount: Number(m.amount),
    }));
  } catch (error) {
    logger.error('Error al obtener movimientos', { data: { error, sessionId } });
    throw new Error('Error al obtener movimientos');
  }
}

/**
 * Obtiene los movimientos de una caja (todas las sesiones)
 */
export async function getCashRegisterMovements(cashRegisterId: string, limit = 50) {
  await checkPermission('commercial.treasury.cash-registers', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const movements = await prisma.cashMovement.findMany({
      where: {
        cashRegisterId,
        companyId,
      },
      select: {
        id: true,
        type: true,
        date: true,
        amount: true,
        description: true,
        reference: true,
        createdBy: true,
        createdAt: true,
        session: {
          select: {
            id: true,
            sessionNumber: true,
            status: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return movements.map((m) => ({
      ...m,
      amount: Number(m.amount),
    }));
  } catch (error) {
    logger.error('Error al obtener movimientos de caja', { data: { error, cashRegisterId } });
    throw new Error('Error al obtener movimientos');
  }
}

/**
 * Elimina un movimiento de caja (solo si la sesión está abierta)
 */
export async function deleteCashMovement(movementId: string) {
  await checkPermission('commercial.treasury.cash-registers', 'delete', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el movimiento existe y la sesión está abierta
    const movement = await prisma.cashMovement.findFirst({
      where: {
        id: movementId,
        companyId,
      },
      select: {
        id: true,
        type: true,
        amount: true,
        session: {
          select: {
            id: true,
            status: true,
            expectedBalance: true,
          },
        },
      },
    });

    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    if (movement.session.status !== 'OPEN') {
      throw new Error('No se puede eliminar un movimiento de una sesión cerrada');
    }

    // No se pueden eliminar movimientos de apertura o cierre
    if (movement.type === 'OPENING' || movement.type === 'CLOSING') {
      throw new Error('No se puede eliminar un movimiento de apertura o cierre');
    }

    // Eliminar movimiento y actualizar saldo esperado en transacción
    await prisma.$transaction(async (tx) => {
      // Calcular nuevo saldo esperado
      let newExpectedBalance = movement.session.expectedBalance;

      if (movement.type === 'INCOME') {
        newExpectedBalance = movement.session.expectedBalance.sub(movement.amount);
      } else if (movement.type === 'EXPENSE') {
        newExpectedBalance = movement.session.expectedBalance.add(movement.amount);
      } else if (movement.type === 'ADJUSTMENT') {
        newExpectedBalance = movement.session.expectedBalance.sub(movement.amount);
      }

      // Actualizar sesión
      await tx.cashRegisterSession.update({
        where: { id: movement.session.id },
        data: { expectedBalance: newExpectedBalance },
      });

      // Eliminar movimiento
      await tx.cashMovement.delete({
        where: { id: movementId },
      });
    });

    logger.info('Movimiento de caja eliminado', {
      data: {
        movementId,
        type: movement.type,
        amount: Number(movement.amount),
      },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar movimiento de caja', { data: { error, movementId } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al eliminar movimiento de caja');
  }
}
