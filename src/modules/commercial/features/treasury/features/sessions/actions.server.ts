'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import {
  openSessionSchema,
  closeSessionSchema,
  type OpenSessionFormData,
  type CloseSessionFormData,
} from '../../shared/validators';
import type { SessionWithMovements } from '../../shared/types';
import { checkPermission } from '@/shared/lib/permissions';

/**
 * Abre una nueva sesión de caja
 */
export async function openCashSession(data: OpenSessionFormData) {
  await checkPermission('commercial.treasury.cash-registers', 'create', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Validar datos
    const validated = openSessionSchema.parse(data);

    // Verificar que la caja existe y está activa
    const cashRegister = await prisma.cashRegister.findFirst({
      where: {
        id: validated.cashRegisterId,
        companyId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        name: true,
        sessions: {
          where: { status: 'OPEN' },
          select: { id: true },
        },
      },
    });

    if (!cashRegister) {
      throw new Error('Caja no encontrada o inactiva');
    }

    // Verificar que no hay sesión abierta
    if (cashRegister.sessions.length > 0) {
      throw new Error('Ya existe una sesión abierta para esta caja');
    }

    // Obtener el siguiente número de sesión
    const lastSession = await prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId: validated.cashRegisterId },
      orderBy: { sessionNumber: 'desc' },
      select: { sessionNumber: true },
    });

    const sessionNumber = (lastSession?.sessionNumber ?? 0) + 1;
    const openingBalance = new Prisma.Decimal(validated.openingBalance);

    // Crear sesión y movimiento de apertura en transacción
    const session = await prisma.$transaction(async (tx) => {
      // Crear sesión
      const newSession = await tx.cashRegisterSession.create({
        data: {
          cashRegisterId: validated.cashRegisterId,
          companyId,
          sessionNumber,
          openingBalance,
          expectedBalance: openingBalance,
          openingNotes: validated.openingNotes,
          openedBy: userId,
        },
      });

      // Crear movimiento de apertura
      await tx.cashMovement.create({
        data: {
          cashRegisterId: validated.cashRegisterId,
          sessionId: newSession.id,
          companyId,
          type: 'OPENING',
          amount: openingBalance,
          description: `Apertura de sesión ${sessionNumber}`,
          reference: `Sesión ${sessionNumber}`,
          createdBy: userId,
        },
      });

      return newSession;
    });

    logger.info('Sesión de caja abierta', {
      data: {
        sessionId: session.id,
        sessionNumber,
        cashRegisterCode: cashRegister.code,
        openingBalance: validated.openingBalance,
      },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true, id: session.id };
  } catch (error) {
    logger.error('Error al abrir sesión de caja', { data: { error } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al abrir sesión de caja');
  }
}

/**
 * Cierra una sesión de caja
 */
export async function closeCashSession(data: CloseSessionFormData) {
  await checkPermission('commercial.treasury.cash-registers', 'update', { redirect: true });
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Validar datos
    const validated = closeSessionSchema.parse(data);

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

    const actualBalance = new Prisma.Decimal(validated.actualBalance);
    const expectedBalance = session.expectedBalance;
    const difference = actualBalance.minus(expectedBalance);

    // Cerrar sesión y crear movimiento de cierre en transacción
    const closedSession = await prisma.$transaction(async (tx) => {
      // Actualizar sesión
      const updated = await tx.cashRegisterSession.update({
        where: { id: validated.sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          actualBalance,
          difference,
          closingNotes: validated.closingNotes,
          closedBy: userId,
        },
      });

      // Crear movimiento de cierre
      await tx.cashMovement.create({
        data: {
          cashRegisterId: session.cashRegister.id,
          sessionId: validated.sessionId,
          companyId,
          type: 'CLOSING',
          amount: actualBalance,
          description: `Cierre de sesión ${session.sessionNumber}`,
          reference: `Sesión ${session.sessionNumber}`,
          createdBy: userId,
        },
      });

      // Si hay diferencia, crear movimiento de ajuste
      if (!difference.isZero()) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: session.cashRegister.id,
            sessionId: validated.sessionId,
            companyId,
            type: 'ADJUSTMENT',
            amount: difference.abs(),
            description: `Ajuste por diferencia en cierre: ${difference.isPositive() ? 'sobrante' : 'faltante'} de $${difference.abs().toFixed(2)}`,
            reference: `Cierre sesión ${session.sessionNumber}`,
            createdBy: userId,
          },
        });
      }

      return updated;
    });

    logger.info('Sesión de caja cerrada', {
      data: {
        sessionId: closedSession.id,
        sessionNumber: session.sessionNumber,
        cashRegisterCode: session.cashRegister.code,
        expectedBalance: expectedBalance.toNumber(),
        actualBalance: actualBalance.toNumber(),
        difference: difference.toNumber(),
      },
    });

    revalidatePath('/dashboard/commercial/treasury/cash-registers');

    return { success: true, id: closedSession.id };
  } catch (error) {
    logger.error('Error al cerrar sesión de caja', { data: { error } });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error al cerrar sesión de caja');
  }
}

/**
 * Obtiene el detalle de una sesión con sus movimientos
 */
export async function getSession(sessionId: string): Promise<SessionWithMovements> {
  await checkPermission('commercial.treasury.cash-registers', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const session = await prisma.cashRegisterSession.findFirst({
      where: {
        id: sessionId,
        companyId,
      },
      select: {
        id: true,
        sessionNumber: true,
        status: true,
        openedAt: true,
        closedAt: true,
        openingBalance: true,
        expectedBalance: true,
        actualBalance: true,
        difference: true,
        openingNotes: true,
        closingNotes: true,
        openedBy: true,
        closedBy: true,
        cashRegister: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        movements: {
          select: {
            id: true,
            type: true,
            date: true,
            amount: true,
            description: true,
            reference: true,
            createdBy: true,
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error('Sesión no encontrada');
    }

    // Convertir Decimals a números
    return {
      ...session,
      openingBalance: Number(session.openingBalance),
      expectedBalance: Number(session.expectedBalance),
      actualBalance: session.actualBalance ? Number(session.actualBalance) : null,
      difference: session.difference ? Number(session.difference) : null,
      movements: session.movements.map((m) => ({
        ...m,
        amount: Number(m.amount),
      })),
    };
  } catch (error) {
    logger.error('Error al obtener sesión', { data: { error, sessionId } });
    throw new Error('Error al obtener sesión');
  }
}

/**
 * Obtiene las sesiones de una caja
 */
export async function getCashRegisterSessions(cashRegisterId: string, limit = 10) {
  await checkPermission('commercial.treasury.cash-registers', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const sessions = await prisma.cashRegisterSession.findMany({
      where: {
        cashRegisterId,
        companyId,
      },
      select: {
        id: true,
        sessionNumber: true,
        status: true,
        openedAt: true,
        closedAt: true,
        openingBalance: true,
        expectedBalance: true,
        actualBalance: true,
        difference: true,
        openedBy: true,
        closedBy: true,
      },
      orderBy: { sessionNumber: 'desc' },
      take: limit,
    });

    return sessions.map((s) => ({
      ...s,
      openingBalance: Number(s.openingBalance),
      expectedBalance: Number(s.expectedBalance),
      actualBalance: s.actualBalance ? Number(s.actualBalance) : null,
      difference: s.difference ? Number(s.difference) : null,
    }));
  } catch (error) {
    logger.error('Error al obtener sesiones', { data: { error, cashRegisterId } });
    throw new Error('Error al obtener sesiones');
  }
}
