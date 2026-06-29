'use server';

import { type CreateJournalEntryInput } from '../../../shared/types';
import { prisma } from '@/shared/lib/prisma';
import { toNumber } from '../../../shared/utils/decimal';

interface LineWithAmounts {
  accountId: string;
  debit: unknown;
  credit: unknown;
}

/**
 * Valida que el asiento esté balanceado (Debe = Haber)
 */
export async function validateJournalEntryBalance(lines: LineWithAmounts[]) {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);

    if (isNaN(debit) || isNaN(credit)) {
      throw new Error('Los montos deben ser números válidos');
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  const tolerance = 0.01;
  const difference = Math.abs(totalDebit - totalCredit);

  if (difference >= tolerance) {
    throw new Error(
      `El asiento no está balanceado. ` +
      `Debe: $${totalDebit.toFixed(2)}, Haber: $${totalCredit.toFixed(2)}, ` +
      `Diferencia: $${difference.toFixed(2)}`
    );
  }

  // Validar mínimo 2 líneas
  if (lines.length < 2) {
    throw new Error('Un asiento debe tener al menos 2 líneas');
  }

  // Validar que no todas las líneas sean 0
  if (totalDebit === 0 && totalCredit === 0) {
    throw new Error('El asiento no puede tener todos los montos en 0');
  }
}

/**
 * Valida que las cuentas existan, pertenezcan a la empresa y sean imputables (hojas)
 */
export async function validateJournalEntryAccounts(companyId: string, accountIds: string[]) {
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      companyId,
      isActive: true
    },
    select: {
      id: true,
      code: true,
      name: true,
      nature: true,
      isLeaf: true,
      requiresAuxiliary: true,
    },
  });

  if (accounts.length !== accountIds.length) {
    throw new Error('Una o más cuentas no existen o no pertenecen a la empresa');
  }

  const nonLeafAccounts = accounts.filter(a => !a.isLeaf);
  if (nonLeafAccounts.length > 0) {
    throw new Error(
      `Las siguientes cuentas no son imputables (tienen subcuentas): ${nonLeafAccounts.map(a => a.code).join(', ')}`
    );
  }

  return accounts;
}

/**
 * Valida auxiliares requeridos en las líneas del asiento.
 * Debe llamarse DESPUÉS de validateJournalEntryAccounts para tener las cuentas cargadas.
 */
export async function validateAuxiliaries(
  companyId: string,
  lines: CreateJournalEntryInput['lines'],
  accounts: { id: string; code: string; requiresAuxiliary: string | null }[]
) {
  for (const line of lines) {
    const account = accounts.find(a => a.id === line.accountId);
    if (!account?.requiresAuxiliary) continue;

    const lineRef = `cuenta ${account.code}`;
    switch (account.requiresAuxiliary) {
      case 'CUSTOMER':
        if (!line.customerId) {
          throw new Error(`La ${lineRef} requiere un cliente como auxiliar`);
        }
        break;
      case 'SUPPLIER':
        if (!line.supplierId) {
          throw new Error(`La ${lineRef} requiere un proveedor como auxiliar`);
        }
        break;
      case 'COST_CENTER':
        if (!line.costCenterId) {
          throw new Error(`La ${lineRef} requiere un centro de costo como auxiliar`);
        }
        break;
    }
  }
}

/**
 * Valida que la fecha no esté en un período bloqueado.
 * Usa el modelo AccountingPeriod si hay períodos creados; fallback a lockedUntilDate.
 */
export async function validatePeriodLock(
  companyId: string,
  date: Date,
  settings?: { lockedUntilDate: Date | null } | null
) {
  const moment = require('moment');
  const entryDate = moment(date);

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      fiscalYear: { companyId },
      year: entryDate.year(),
      month: entryDate.month() + 1,
      type: 'MONTHLY',
    },
    select: { isClosed: true },
  });

  if (period) {
    if (period.isClosed) {
      throw new Error(
        `No se puede operar en el período ${entryDate.format('MM/YYYY')}. ` +
        `El período está cerrado.`
      );
    }
    return;
  }

  // Fallback: lockedUntilDate (backward compat)
  const lockSettings = settings ?? await prisma.accountingSettings.findUnique({
    where: { companyId },
    select: { lockedUntilDate: true },
  });

  if (lockSettings?.lockedUntilDate) {
    const lockDate = moment(lockSettings.lockedUntilDate);

    if (entryDate.isSameOrBefore(lockDate, 'day')) {
      throw new Error(
        `No se puede operar en el período ${entryDate.format('MM/YYYY')}. ` +
        `Los períodos están bloqueados hasta ${lockDate.format('MM/YYYY')}.`
      );
    }
  }
}

/**
 * Valida que la fecha del asiento esté dentro de un ejercicio fiscal abierto.
 * Usa FiscalYear si existe; fallback a AccountingSettings.
 */
export async function validateJournalEntryDate(companyId: string, date: Date) {
  const moment = require('moment');
  const { logger } = require('@/shared/lib/logger');
  const entryDate = moment(date);

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      companyId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true, isClosed: true, startDate: true, endDate: true },
  });

  if (fiscalYear) {
    if (fiscalYear.isClosed) {
      throw new Error(
        `El ejercicio fiscal (${moment(fiscalYear.startDate).format('DD/MM/YYYY')} - ${moment(fiscalYear.endDate).format('DD/MM/YYYY')}) está cerrado`
      );
    }
    await validatePeriodLock(companyId, date);
    return;
  }

  // Fallback: usar AccountingSettings
  const settings = await prisma.accountingSettings.findUnique({
    where: { companyId }
  });

  if (!settings) {
    throw new Error('No se encontró configuración contable para la empresa');
  }

  const fiscalStart = moment(settings.fiscalYearStart);
  const fiscalEnd = moment(settings.fiscalYearEnd);

  if (!entryDate.isBetween(fiscalStart, fiscalEnd, 'day', '[]')) {
    throw new Error(
      `La fecha del asiento (${entryDate.format('DD/MM/YYYY')}) está fuera del ejercicio fiscal ` +
      `(${fiscalStart.format('DD/MM/YYYY')} - ${fiscalEnd.format('DD/MM/YYYY')})`
    );
  }

  await validatePeriodLock(companyId, date, settings);

  if (entryDate.isBefore(moment().subtract(6, 'months'))) {
    logger.warn('Asiento con fecha antigua', {
      data: {
        date: entryDate.format('YYYY-MM-DD'),
        companyId,
        monthsAgo: moment().diff(entryDate, 'months'),
      }
    });
  }
}

/**
 * Valida que los montos sean positivos
 */
export async function validateJournalEntryAmounts(lines: LineWithAmounts[]) {
  for (const line of lines) {
    if (toNumber(line.debit) < 0 || toNumber(line.credit) < 0) {
      throw new Error('Los montos deben ser positivos');
    }

    if (toNumber(line.debit) > 0 && toNumber(line.credit) > 0) {
      throw new Error('Una línea no puede tener Debe y Haber al mismo tiempo');
    }

    if (toNumber(line.debit) === 0 && toNumber(line.credit) === 0) {
      throw new Error('Una línea debe tener Debe o Haber');
    }
  }
}

/**
 * Valida que las cuentas se usen según su naturaleza (DEBIT/CREDIT)
 * Emite warnings, no errores (permite flexibilidad contable)
 */
export async function validateAccountNatures(
  companyId: string,
  lines: LineWithAmounts[]
) {
  const { logger } = require('@/shared/lib/logger');

  const accountIds = lines.map(line => line.accountId);
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      companyId,
    },
    select: { id: true, code: true, name: true, nature: true },
  });

  const warnings: string[] = [];

  for (const line of lines) {
    const account = accounts.find(a => a.id === line.accountId);
    if (!account) continue;

    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);

    if (account.nature === 'DEBIT' && credit > debit) {
      warnings.push(
        `Cuenta "${account.code} - ${account.name}" tiene naturaleza deudora ` +
        `pero se registra más crédito ($${credit}) que débito ($${debit})`
      );
    }

    if (account.nature === 'CREDIT' && debit > credit) {
      warnings.push(
        `Cuenta "${account.code} - ${account.name}" tiene naturaleza acreedora ` +
        `pero se registra más débito ($${debit}) que crédito ($${credit})`
      );
    }
  }

  if (warnings.length > 0) {
    logger.warn('Advertencias de naturaleza de cuentas', {
      data: { warnings, companyId }
    });
  }

  return warnings;
}

/**
 * Resuelve el fiscalYearId y periodId para una fecha dada.
 * Retorna null si no se encuentra ejercicio (no bloquea, el asiento queda sin período).
 */
export async function resolveFiscalPeriod(companyId: string, date: Date) {
  const moment = require('moment');
  const entryDate = moment(date);

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      companyId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true },
  });

  if (!fiscalYear) return null;

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      fiscalYearId: fiscalYear.id,
      year: entryDate.year(),
      month: entryDate.month() + 1,
      type: 'MONTHLY',
    },
    select: { id: true },
  });

  return {
    fiscalYearId: fiscalYear.id,
    periodId: period?.id ?? null,
  };
}
