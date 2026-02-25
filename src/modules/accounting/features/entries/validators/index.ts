'use server';

import { type JournalEntryLine } from '@/generated/prisma/client';
import { type CreateJournalEntryInput } from '../../../shared/types';
import { type AccountWithChildren } from '../../../shared/types';
import { prisma } from '@/shared/lib/prisma';
import { toNumber, sum } from '../../../shared/utils/decimal';

/**
 * Valida que el asiento esté balanceado (Debe = Haber)
 */
export async function validateJournalEntryBalance(lines: JournalEntryLine[] | CreateJournalEntryInput['lines']) {
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
 * Valida que las cuentas existan y pertenezcan a la empresa
 */
export async function validateJournalEntryAccounts(companyId: string, accountIds: string[]) {
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      companyId,
      isActive: true
    }
  });

  if (accounts.length !== accountIds.length) {
    throw new Error('Una o más cuentas no existen o no pertenecen a la empresa');
  }

  return accounts;
}

/**
 * Valida que la fecha no esté en un período bloqueado.
 * Puede recibir settings ya cargados para evitar query duplicada.
 */
export async function validatePeriodLock(
  companyId: string,
  date: Date,
  settings?: { lockedUntilDate: Date | null } | null
) {
  const moment = require('moment');

  const lockSettings = settings ?? await prisma.accountingSettings.findUnique({
    where: { companyId },
    select: { lockedUntilDate: true },
  });

  if (lockSettings?.lockedUntilDate) {
    const entryDate = moment(date);
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
 * Valida que la fecha del asiento esté dentro del ejercicio fiscal
 */
export async function validateJournalEntryDate(companyId: string, date: Date) {
  const moment = require('moment');
  const { logger } = require('@/shared/lib/logger');

  const settings = await prisma.accountingSettings.findUnique({
    where: { companyId }
  });

  if (!settings) {
    throw new Error('No se encontró configuración contable para la empresa');
  }

  const entryDate = moment(date);
  const fiscalStart = moment(settings.fiscalYearStart);
  const fiscalEnd = moment(settings.fiscalYearEnd);

  if (!entryDate.isBetween(fiscalStart, fiscalEnd, 'day', '[]')) {
    throw new Error(
      `La fecha del asiento (${entryDate.format('DD/MM/YYYY')}) está fuera del ejercicio fiscal ` +
      `(${fiscalStart.format('DD/MM/YYYY')} - ${fiscalEnd.format('DD/MM/YYYY')})`
    );
  }

  // Validar bloqueo de período
  await validatePeriodLock(companyId, date, settings);

  // Advertir si la fecha es muy antigua (más de 6 meses)
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
export async function validateJournalEntryAmounts(lines: JournalEntryLine[] | CreateJournalEntryInput['lines']) {
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
  lines: JournalEntryLine[] | CreateJournalEntryInput['lines']
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

    // Cuenta de naturaleza DEBIT con más crédito que débito
    if (account.nature === 'DEBIT' && credit > debit) {
      warnings.push(
        `Cuenta "${account.code} - ${account.name}" tiene naturaleza deudora ` +
        `pero se registra más crédito ($${credit}) que débito ($${debit})`
      );
    }

    // Cuenta de naturaleza CREDIT con más débito que crédito
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
