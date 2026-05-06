'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { JournalEntryStatus } from '@/generated/prisma/enums';
import { revalidateAccountingRoutes } from '../../shared/utils';
import moment from 'moment';

interface ClosingLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface FiscalYearStatus {
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
  resultAccountId: string | null;
  resultAccountName: string | null;
  isClosed: boolean;
  closingEntryId: string | null;
  closingEntryNumber: number | null;
}

interface ClosePreview {
  lines: ClosingLine[];
  totalRevenue: number;
  totalExpense: number;
  netResult: number;
}

/**
 * Obtiene el estado del ejercicio fiscal
 */
export async function getFiscalYearStatus(companyId: string): Promise<FiscalYearStatus> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.fiscal-year-close', 'view', { redirect: true });

  try {
    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
      include: {
        resultAccount: {
          select: { name: true },
        },
      },
    });

    if (!settings) {
      throw new Error('No hay configuración contable. Configure el ejercicio fiscal primero.');
    }

    // Buscar si ya existe un asiento de cierre en el período
    const closingEntry = await prisma.journalEntry.findFirst({
      where: {
        companyId,
        description: {
          startsWith: 'Cierre de ejercicio fiscal',
        },
        date: {
          gte: settings.fiscalYearStart,
          lte: settings.fiscalYearEnd,
        },
        status: JournalEntryStatus.POSTED,
      },
      select: {
        id: true,
        number: true,
      },
    });

    return {
      fiscalYearStart: settings.fiscalYearStart,
      fiscalYearEnd: settings.fiscalYearEnd,
      resultAccountId: settings.resultAccountId,
      resultAccountName: settings.resultAccount?.name ?? null,
      isClosed: !!closingEntry,
      closingEntryId: closingEntry?.id ?? null,
      closingEntryNumber: closingEntry?.number ?? null,
    };
  } catch (error) {
    logger.error('Error al obtener estado del ejercicio fiscal', { data: { error, companyId } });
    throw error;
  }
}

/**
 * Genera preview del asiento de cierre de ejercicio
 */
export async function previewFiscalYearClose(companyId: string): Promise<ClosePreview> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.fiscal-year-close', 'view', { redirect: true });

  try {
    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      throw new Error('No hay configuración contable');
    }

    if (!settings.resultAccountId) {
      throw new Error('No se ha configurado la cuenta de Resultado del Ejercicio en Settings');
    }

    // Obtener cuentas de REVENUE y EXPENSE con sus saldos en el período fiscal
    const revenueAndExpenseAccounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        type: { in: ['REVENUE', 'EXPENSE'] },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        nature: true,
      },
      orderBy: { code: 'asc' },
    });

    const lines: ClosingLine[] = [];
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const account of revenueAndExpenseAccounts) {
      // Calcular saldo de la cuenta en el período fiscal
      const entryLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: account.id,
          entry: {
            companyId,
            status: JournalEntryStatus.POSTED,
            date: {
              gte: settings.fiscalYearStart,
              lte: settings.fiscalYearEnd,
            },
          },
        },
        select: {
          debit: true,
          credit: true,
        },
      });

      let debitSum = 0;
      let creditSum = 0;
      for (const line of entryLines) {
        debitSum += Number(line.debit);
        creditSum += Number(line.credit);
      }

      const balance = debitSum - creditSum;

      if (Math.abs(balance) < 0.01) continue; // Sin saldo, no incluir

      if (account.type === 'REVENUE') {
        totalRevenue += Math.abs(balance);
        // Revenue normalmente tiene saldo acreedor (credit > debit, balance negativo)
        // Para cerrar: invertir el saldo
        lines.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          debit: balance < 0 ? Math.abs(balance) : 0,
          credit: balance > 0 ? balance : 0,
        });
      } else {
        // EXPENSE
        totalExpense += Math.abs(balance);
        // Expense normalmente tiene saldo deudor (debit > credit, balance positivo)
        // Para cerrar: invertir el saldo
        lines.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          debit: balance < 0 ? Math.abs(balance) : 0,
          credit: balance > 0 ? balance : 0,
        });
      }
    }

    // Contrapartida: cuenta de resultado del ejercicio
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    const resultDiff = totalDebit - totalCredit;

    const resultAccount = await prisma.account.findUnique({
      where: { id: settings.resultAccountId },
      select: { id: true, code: true, name: true },
    });

    if (!resultAccount) {
      throw new Error('La cuenta de Resultado del Ejercicio configurada no existe');
    }

    // Si totalDebit > totalCredit => hay ganancia (la línea de resultado va al Haber)
    // Si totalCredit > totalDebit => hay pérdida (la línea de resultado va al Debe)
    lines.push({
      accountId: resultAccount.id,
      accountCode: resultAccount.code,
      accountName: resultAccount.name,
      debit: resultDiff < 0 ? Math.abs(resultDiff) : 0,
      credit: resultDiff > 0 ? resultDiff : 0,
    });

    const netResult = totalRevenue - totalExpense;

    return {
      lines,
      totalRevenue,
      totalExpense,
      netResult,
    };
  } catch (error) {
    logger.error('Error al generar preview de cierre', { data: { error, companyId } });
    throw error;
  }
}

/**
 * Ejecuta el cierre del ejercicio fiscal
 */
export async function closeFiscalYear(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.fiscal-year-close', 'approve', { redirect: true });

  try {
    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      throw new Error('No hay configuración contable');
    }

    if (!settings.resultAccountId) {
      throw new Error('No se ha configurado la cuenta de Resultado del Ejercicio');
    }

    // Verificar que no esté cerrado
    const existingClose = await prisma.journalEntry.findFirst({
      where: {
        companyId,
        description: { startsWith: 'Cierre de ejercicio fiscal' },
        date: {
          gte: settings.fiscalYearStart,
          lte: settings.fiscalYearEnd,
        },
        status: JournalEntryStatus.POSTED,
      },
    });

    if (existingClose) {
      throw new Error('El ejercicio fiscal ya fue cerrado');
    }

    // Generar preview para obtener las líneas
    const preview = await previewFiscalYearClose(companyId);

    if (preview.lines.length === 0) {
      throw new Error('No hay cuentas de resultado con saldo para cerrar');
    }

    const description = `Cierre de ejercicio fiscal ${moment(settings.fiscalYearStart).format('DD/MM/YYYY')} - ${moment(settings.fiscalYearEnd).format('DD/MM/YYYY')}`;

    // Crear y registrar el asiento de cierre en una transacción
    const result = await prisma.$transaction(async (tx) => {
      const nextNumber = settings.lastEntryNumber + 1;

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          number: nextNumber,
          date: settings.fiscalYearEnd,
          description,
          createdBy: userId,
          status: JournalEntryStatus.POSTED,
          postDate: new Date(),
          lines: {
            create: preview.lines.map((line) => ({
              accountId: line.accountId,
              description: `Cierre - ${line.accountName}`,
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
        data: {
          lastEntryNumber: nextNumber,
          lockedUntilDate: settings.fiscalYearEnd,
        },
      });

      return entry;
    });

    logger.info('Ejercicio fiscal cerrado', {
      data: { companyId, entryId: result.id, entryNumber: result.number, userId },
    });

    revalidateAccountingRoutes(companyId);

    return result;
  } catch (error) {
    logger.error('Error al cerrar ejercicio fiscal', { data: { error, companyId } });
    throw error;
  }
}
