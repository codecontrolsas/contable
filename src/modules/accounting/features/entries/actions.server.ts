'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { revalidateAccountingRoutes } from '../../shared/utils';
import { type CreateJournalEntryInput } from '../../shared/types';
import { validateJournalEntryAccounts, validateJournalEntryBalance, validateJournalEntryDate, validateJournalEntryAmounts, validateAccountNatures, validatePeriodLock } from './validators';

import { JournalEntryStatus } from '@/generated/prisma/enums';

/**
 * Crea un nuevo asiento contable
 */
export async function createJournalEntry(companyId: string, input: CreateJournalEntryInput) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.entries', 'create', { redirect: true });

  try {
    // Validaciones (fuera de la transacción, son de solo lectura)
    await validateJournalEntryAccounts(companyId, input.lines.map(line => line.accountId));
    await validateJournalEntryDate(companyId, input.date);
    await validateJournalEntryBalance(input.lines);
    await validateJournalEntryAmounts(input.lines);

    // Validación de naturaleza (warnings, no bloquean)
    await validateAccountNatures(companyId, input.lines);

    // Crear asiento y actualizar número atómicamente
    const result = await prisma.$transaction(async (tx) => {
      // Incremento atómico: UPDATE ... RETURNING evita race conditions
      const [{ last_entry_number: nextNumber }] = await tx.$queryRaw<[{ last_entry_number: number }]>`
        UPDATE accounting_settings
        SET last_entry_number = last_entry_number + 1, updated_at = NOW()
        WHERE company_id = ${companyId}::uuid
        RETURNING last_entry_number
      `;

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          number: nextNumber,
          date: input.date,
          description: input.description,
          createdBy: userId,
          lines: {
            create: input.lines,
          },
        },
        select: {
          id: true,
          companyId: true,
          number: true,
          date: true,
          description: true,
          status: true,
          postDate: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          lines: {
            select: {
              id: true,
              entryId: true,
              accountId: true,
              description: true,
              debit: true,
              credit: true,
              account: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return entry;
    });

    logger.info('Asiento contable creado', { data: { entryId: result.id, userId } });
    revalidateAccountingRoutes(companyId);

    return result;
  } catch (error) {
    logger.error('Error al crear asiento contable', { data: { error, userId } });
    throw error;
  }
}

/**
 * Registra un asiento contable
 */
export async function postJournalEntry(companyId: string, entryId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.entries', 'approve', { redirect: true });

  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        companyId: true,
        number: true,
        date: true,
        description: true,
        status: true,
        postDate: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        lines: {
          select: {
            id: true,
            entryId: true,
            accountId: true,
            description: true,
            debit: true,
            credit: true,
          },
        },
      },
    });

    if (!entry) {
      throw new Error('Asiento no encontrado');
    }

    if (entry.companyId !== companyId) {
      throw new Error('El asiento no pertenece a la empresa');
    }

    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new Error('El asiento no está en estado borrador');
    }

    // Validar que el período no esté bloqueado
    await validatePeriodLock(companyId, entry.date);

    // Validar nuevamente el balance
    await validateJournalEntryBalance(entry.lines);
    await validateJournalEntryAmounts(entry.lines);
  
    const updatedEntry = await prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: JournalEntryStatus.POSTED,
        postDate: new Date(),
      },
      select: {
        id: true,
        companyId: true,
        number: true,
        date: true,
        description: true,
        status: true,
        postDate: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        lines: {
          select: {
            id: true,
            entryId: true,
            accountId: true,
            description: true,
            debit: true,
            credit: true,
            account: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    logger.info('Asiento contable registrado', { data: { entryId, userId } });
    revalidateAccountingRoutes(companyId);

    return updatedEntry;
  } catch (error) {
    logger.error('Error al registrar asiento contable', { data: { error, entryId, userId } });
    throw error;
  }
}

/**
 * Anula un asiento contable
 */
export async function reverseJournalEntry(companyId: string, entryId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.entries', 'approve', { redirect: true });

  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        companyId: true,
        number: true,
        date: true,
        description: true,
        status: true,
        postDate: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        lines: {
          select: {
            id: true,
            entryId: true,
            accountId: true,
            description: true,
            debit: true,
            credit: true,
          },
        },
      },
    });

    if (!entry) {
      throw new Error('Asiento no encontrado');
    }

    if (entry.companyId !== companyId) {
      throw new Error('El asiento no pertenece a la empresa');
    }

    // Validar que el período no esté bloqueado
    await validatePeriodLock(companyId, entry.date);

    if (entry.status !== JournalEntryStatus.POSTED) {
      throw new Error('Solo se pueden anular asientos registrados');
    }

    // Crear asiento de reversión
    const result = await prisma.$transaction(async (tx) => {
      // Incremento atómico: UPDATE ... RETURNING evita race conditions
      const [{ last_entry_number: nextNumber }] = await tx.$queryRaw<[{ last_entry_number: number }]>`
        UPDATE accounting_settings
        SET last_entry_number = last_entry_number + 1, updated_at = NOW()
        WHERE company_id = ${companyId}::uuid
        RETURNING last_entry_number
      `;

      // Crear asiento de reversión primero
      const reversalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          number: nextNumber,
          date: new Date(),
          description: `Anulación del asiento N° ${entry.number} - ${entry.description}`,
          status: JournalEntryStatus.POSTED,
          postDate: new Date(),
          createdBy: userId,
          originalEntryId: entryId, // Link al asiento original
          lines: {
            create: entry.lines.map(line => ({
              accountId: line.accountId,
              description: line.description,
              debit: line.credit, // Invertir débito y crédito
              credit: line.debit,
            })),
          },
        },
        select: {
          id: true,
          companyId: true,
          number: true,
          date: true,
          description: true,
          status: true,
          postDate: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          lines: {
            select: {
              id: true,
              entryId: true,
              accountId: true,
              description: true,
              debit: true,
              credit: true,
              account: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Marcar el asiento original como anulado
      await tx.journalEntry.update({
        where: { id: entryId },
        data: {
          status: JournalEntryStatus.REVERSED,
          reversalEntryId: reversalEntry.id, // Link al asiento de reversión
          reversedBy: userId,
          reversedAt: new Date(),
        },
      });

      return reversalEntry;
    });

    logger.info('Asiento contable anulado', { data: { entryId, reversalId: result.id, userId } });
    revalidateAccountingRoutes(companyId);

    return result;
  } catch (error) {
    logger.error('Error al anular asiento contable', { data: { error, entryId, userId } });
    throw error;
  }
}

/**
 * Obtiene todos los asientos contables de una empresa
 */
export async function getJournalEntries(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.entries', 'view', { redirect: true });

  try {
    const entries = await prisma.journalEntry.findMany({
      where: { companyId },
      orderBy: [
        { date: 'desc' },
        { number: 'desc' },
      ],
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
        originalEntry: {
          select: { number: true },
        },
        reversalEntry: {
          select: { number: true },
        },
        salesInvoices: {
          select: { id: true, fullNumber: true },
        },
        purchaseInvoices: {
          select: { id: true, fullNumber: true },
        },
        receipts: {
          select: { id: true, fullNumber: true },
        },
        paymentOrders: {
          select: { id: true, fullNumber: true },
        },
      },
    });

    return entries;
  } catch (error) {
    logger.error('Error al obtener asientos contables', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene un asiento contable por ID
 */
export async function getJournalEntryById(companyId: string, entryId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.entries', 'view', { redirect: true });

  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
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
          select: {
            id: true,
            entryId: true,
            accountId: true,
            description: true,
            debit: true,
            credit: true,
          },
        },
      },
    });

    if (!entry) {
      throw new Error('Asiento no encontrado');
    }

    if (entry.companyId !== companyId) {
      throw new Error('El asiento no pertenece a la empresa');
    }

    return entry;
  } catch (error) {
    logger.error('Error al obtener asiento contable', { data: { error, entryId, userId } });
    throw error;
  }
}
