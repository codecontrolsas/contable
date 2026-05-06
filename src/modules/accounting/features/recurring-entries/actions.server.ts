'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { JournalEntryStatus } from '@/generated/prisma/enums';
import { type RecurringFrequency } from '@/generated/prisma/enums';
import { revalidateAccountingRoutes } from '../../shared/utils';
import { recurringEntrySchema } from './validators';
import moment from 'moment';

/**
 * Calcula la siguiente fecha de generación según frecuencia
 */
function calculateNextDueDate(currentDate: Date, frequency: RecurringFrequency): Date {
  const m = moment(currentDate);
  switch (frequency) {
    case 'MONTHLY':
      return m.add(1, 'month').toDate();
    case 'BIMONTHLY':
      return m.add(2, 'months').toDate();
    case 'QUARTERLY':
      return m.add(3, 'months').toDate();
    case 'SEMIANNUAL':
      return m.add(6, 'months').toDate();
    case 'ANNUAL':
      return m.add(1, 'year').toDate();
    default:
      return m.add(1, 'month').toDate();
  }
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'Mensual',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

/**
 * Obtiene todos los asientos recurrentes de la empresa
 */
export async function getRecurringEntries(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.recurring-entries', 'view', { redirect: true });

  try {
    const entries = await prisma.recurringEntry.findMany({
      where: {
        companyId,
        isActive: true,
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { nextDueDate: 'asc' },
    });

    const now = new Date();
    return entries.map((entry) => ({
      ...entry,
      frequencyLabel: FREQUENCY_LABELS[entry.frequency] ?? entry.frequency,
      isPending: entry.nextDueDate <= now && (!entry.endDate || entry.endDate >= now),
    }));
  } catch (error) {
    logger.error('Error al obtener asientos recurrentes', { data: { error, companyId } });
    throw error;
  }
}

/**
 * Crea un nuevo asiento recurrente
 */
export async function createRecurringEntry(
  companyId: string,
  input: {
    name: string;
    description: string;
    frequency: RecurringFrequency;
    startDate: Date;
    endDate?: Date | null;
    lines: { accountId: string; description?: string; debit: number; credit: number }[];
  }
) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.recurring-entries', 'create', { redirect: true });

  try {
    // Validar con Zod
    const validated = recurringEntrySchema.parse(input);

    const nextDueDate = validated.startDate;

    const entry = await prisma.$transaction(async (tx) => {
      return tx.recurringEntry.create({
        data: {
          companyId,
          name: validated.name,
          description: validated.description,
          frequency: validated.frequency,
          startDate: validated.startDate,
          endDate: validated.endDate ?? null,
          nextDueDate,
          createdBy: userId,
          lines: {
            create: validated.lines.map((line) => ({
              accountId: line.accountId,
              description: line.description,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
        include: {
          lines: true,
        },
      });
    });

    logger.info('Asiento recurrente creado', { data: { entryId: entry.id, userId } });
    revalidateAccountingRoutes(companyId);

    return entry;
  } catch (error) {
    logger.error('Error al crear asiento recurrente', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Elimina (soft delete) un asiento recurrente
 */
export async function deleteRecurringEntry(companyId: string, id: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.recurring-entries', 'delete', { redirect: true });

  try {
    const entry = await prisma.recurringEntry.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (!entry || entry.companyId !== companyId) {
      throw new Error('Asiento recurrente no encontrado');
    }

    await prisma.recurringEntry.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Asiento recurrente eliminado', { data: { id, userId } });
    revalidateAccountingRoutes(companyId);
  } catch (error) {
    logger.error('Error al eliminar asiento recurrente', { data: { error, id, userId } });
    throw error;
  }
}

/**
 * Genera un asiento contable desde una plantilla recurrente
 */
export async function generateRecurringEntry(companyId: string, recurringEntryId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.recurring-entries', 'create', { redirect: true });

  try {
    const recurring = await prisma.recurringEntry.findUnique({
      where: { id: recurringEntryId },
      include: {
        lines: true,
      },
    });

    if (!recurring || recurring.companyId !== companyId) {
      throw new Error('Asiento recurrente no encontrado');
    }

    if (!recurring.isActive) {
      throw new Error('El asiento recurrente está inactivo');
    }

    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      throw new Error('No hay configuración contable');
    }

    const periodLabel = moment(recurring.nextDueDate).format('MM/YYYY');
    const description = `${recurring.name} - ${periodLabel}`;

    const result = await prisma.$transaction(async (tx) => {
      const nextNumber = settings.lastEntryNumber + 1;

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          number: nextNumber,
          date: recurring.nextDueDate,
          description,
          createdBy: userId,
          status: JournalEntryStatus.DRAFT,
          lines: {
            create: recurring.lines.map((line) => ({
              accountId: line.accountId,
              description: line.description,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
        select: {
          id: true,
          number: true,
        },
      });

      await tx.accountingSettings.update({
        where: { companyId },
        data: { lastEntryNumber: nextNumber },
      });

      // Actualizar la plantilla recurrente
      const newNextDueDate = calculateNextDueDate(recurring.nextDueDate, recurring.frequency);

      await tx.recurringEntry.update({
        where: { id: recurringEntryId },
        data: {
          lastGenerated: recurring.nextDueDate,
          nextDueDate: newNextDueDate,
        },
      });

      return entry;
    });

    logger.info('Asiento generado desde plantilla recurrente', {
      data: { recurringEntryId, entryId: result.id, userId },
    });

    revalidateAccountingRoutes(companyId);
    return result;
  } catch (error) {
    logger.error('Error al generar asiento recurrente', { data: { error, recurringEntryId, userId } });
    throw error;
  }
}

/**
 * Genera todos los asientos recurrentes pendientes
 */
export async function generateAllPendingRecurringEntries(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.recurring-entries', 'create', { redirect: true });

  try {
    const now = new Date();
    const pending = await prisma.recurringEntry.findMany({
      where: {
        companyId,
        isActive: true,
        nextDueDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      select: { id: true, name: true },
    });

    let generated = 0;
    const errors: string[] = [];

    for (const entry of pending) {
      try {
        await generateRecurringEntry(companyId, entry.id);
        generated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        errors.push(`${entry.name}: ${msg}`);
      }
    }

    logger.info('Generación masiva de asientos recurrentes', {
      data: { companyId, generated, errors: errors.length, userId },
    });

    revalidateAccountingRoutes(companyId);
    return { generated, errors };
  } catch (error) {
    logger.error('Error en generación masiva de recurrentes', { data: { error, companyId } });
    throw error;
  }
}
