'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { revalidateAccountingRoutes } from '../../shared/utils';

/**
 * Obtiene la configuración contable de una empresa
 */
export async function getAccountingSettings(companyId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');

  try {
    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
    });

    return settings;
  } catch (error) {
    logger.error('Error al obtener configuración contable', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Crea o actualiza la configuración contable de una empresa
 */
export async function saveAccountingSettings(
  companyId: string,
  input: {
    fiscalYearStart: Date;
    fiscalYearEnd: Date;
    salesAccountId?: string | null;
    purchasesAccountId?: string | null;
    receivablesAccountId?: string | null;
    payablesAccountId?: string | null;
    vatDebitAccountId?: string | null;
    vatCreditAccountId?: string | null;
    defaultCashAccountId?: string | null;
    defaultBankAccountId?: string | null;
    expensesAccountId?: string | null;
    resultAccountId?: string | null;
    withholdingIvaEmittedAccountId?: string | null;
    withholdingGananciasEmittedAccountId?: string | null;
    withholdingIibbEmittedAccountId?: string | null;
    withholdingSussEmittedAccountId?: string | null;
    withholdingIvaSufferedAccountId?: string | null;
    withholdingGananciasSufferedAccountId?: string | null;
    withholdingIibbSufferedAccountId?: string | null;
    withholdingSussSufferedAccountId?: string | null;
    // Cuentas de Activos Fijos
    fixedAssetAccountId?: string | null;
    accumulatedDepreciationAccountId?: string | null;
    depreciationExpenseAccountId?: string | null;
    assetDisposalGainLossAccountId?: string | null;
  }
) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');

  try {
    // Validar que el ejercicio no sea mayor a un año
    const yearInMs = 366 * 24 * 60 * 60 * 1000; // 366 días para contemplar años bisiestos
    if (input.fiscalYearEnd.getTime() - input.fiscalYearStart.getTime() > yearInMs) {
      throw new Error('El ejercicio fiscal no puede ser mayor a un año');
    }

    // Validar que la fecha de fin sea posterior a la de inicio
    if (input.fiscalYearEnd <= input.fiscalYearStart) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    const settings = await prisma.accountingSettings.upsert({
      where: { companyId },
      create: {
        ...input,
        companyId,
      },
      update: input,
    });

    logger.info('Configuración contable guardada', { data: { companyId, userId } });
    revalidateAccountingRoutes(companyId);

    return settings;
  } catch (error) {
    logger.error('Error al guardar configuración contable', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene todas las cuentas activas de la empresa para los selectores
 */
export async function getActiveAccounts(companyId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');

  try {
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        nature: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    return accounts;
  } catch (error) {
    logger.error('Error al obtener cuentas', { data: { error, companyId, userId } });
    throw error;
  }
}
