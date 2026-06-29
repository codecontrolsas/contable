'use server';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import moment from 'moment';
import { revalidatePath } from 'next/cache';

// ============================================
// LIQUIDACIÓN IVA — DDJJ MENSUAL
// ============================================

interface VatSettlementPreview {
  period: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  status: 'A_PAGAR' | 'A_FAVOR';
}

export async function previewVatSettlement(
  year: number,
  month: number
): Promise<VatSettlementPreview> {
  await checkPermission('accounting.reports', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
      select: {
        vatDebitAccountId: true,
        vatCreditAccountId: true,
        vatAccounts: { select: { accountId: true, side: true } },
      },
    });

    if (!settings) throw new Error('Configuración contable no encontrada');

    // Recolectar todas las cuentas de IVA
    const debitAccountIds: string[] = [];
    const creditAccountIds: string[] = [];

    if (settings.vatDebitAccountId) debitAccountIds.push(settings.vatDebitAccountId);
    if (settings.vatCreditAccountId) creditAccountIds.push(settings.vatCreditAccountId);

    for (const va of settings.vatAccounts) {
      if (va.side === 'DEBIT') debitAccountIds.push(va.accountId);
      else creditAccountIds.push(va.accountId);
    }

    const startDate = moment(`${year}-${month}-01`, 'YYYY-M-DD').startOf('month').toDate();
    const endDate = moment(startDate).endOf('month').toDate();

    // Calcular IVA Débito del período
    const debitResult = await prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(jel.credit) - SUM(jel.debit), 0)::float AS total
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
      WHERE je.company_id = ${companyId}::uuid
        AND je.status = 'POSTED'
        AND je.date >= ${startDate}
        AND je.date <= ${endDate}
        AND jel.account_id = ANY(${debitAccountIds}::uuid[])
    `;

    // Calcular IVA Crédito del período
    const creditResult = await prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)::float AS total
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
      WHERE je.company_id = ${companyId}::uuid
        AND je.status = 'POSTED'
        AND je.date >= ${startDate}
        AND je.date <= ${endDate}
        AND jel.account_id = ANY(${creditAccountIds}::uuid[])
    `;

    const totalDebit = debitResult[0].total;
    const totalCredit = creditResult[0].total;
    const balance = totalDebit - totalCredit;

    return {
      period: moment(startDate).format('MM/YYYY'),
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      status: balance > 0 ? 'A_PAGAR' : 'A_FAVOR',
    };
  } catch (error) {
    logger.error('Error al previsualizar liquidación IVA', {
      data: { error, companyId, year, month },
    });
    throw error;
  }
}

export async function generateVatSettlementEntry(year: number, month: number) {
  await checkPermission('accounting.entries', 'create', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const settings = await prisma.accountingSettings.findUnique({
      where: { companyId },
      select: {
        vatDebitAccountId: true,
        vatCreditAccountId: true,
        vatPayableAccountId: true,
        vatBalanceAccountId: true,
        vatAccounts: { select: { accountId: true, side: true } },
      },
    });

    if (!settings) throw new Error('Configuración contable no encontrada');

    if (!settings.vatDebitAccountId || !settings.vatCreditAccountId) {
      throw new Error('Configure las cuentas de IVA DF y CF antes de liquidar');
    }

    if (!settings.vatPayableAccountId && !settings.vatBalanceAccountId) {
      throw new Error('Configure las cuentas de IVA a Pagar y/o IVA Saldo a Favor');
    }

    const preview = await previewVatSettlement(year, month);

    if (preview.totalDebit === 0 && preview.totalCredit === 0) {
      throw new Error('No hay movimientos de IVA en el período');
    }

    const startDate = moment(`${year}-${month}-01`, 'YYYY-M-DD').startOf('month').toDate();
    const endDate = moment(startDate).endOf('month').toDate();

    const result = await prisma.$transaction(async (tx) => {
      const [{ last_entry_number: nextNumber }] = await tx.$queryRaw<
        [{ last_entry_number: number }]
      >`
        UPDATE accounting_settings
        SET last_entry_number = last_entry_number + 1, updated_at = NOW()
        WHERE company_id = ${companyId}::uuid
        RETURNING last_entry_number
      `;

      const fiscalYear = await tx.fiscalYear.findFirst({
        where: { companyId, startDate: { lte: endDate }, endDate: { gte: startDate } },
        select: { id: true },
      });

      let periodId: string | undefined;
      if (fiscalYear) {
        const period = await tx.accountingPeriod.findFirst({
          where: { fiscalYearId: fiscalYear.id, year, month, type: 'MONTHLY' },
          select: { id: true },
        });
        periodId = period?.id;
      }

      interface EntryLine {
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        description: string;
      }

      const lines: EntryLine[] = [];

      // Cancelar IVA Débito (siempre al debe)
      lines.push({
        accountId: settings.vatDebitAccountId!,
        debit: new Prisma.Decimal(preview.totalDebit),
        credit: new Prisma.Decimal(0),
        description: `IVA Débito Fiscal ${preview.period}`,
      });

      // Cancelar IVA Crédito (siempre al haber)
      lines.push({
        accountId: settings.vatCreditAccountId!,
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(preview.totalCredit),
        description: `IVA Crédito Fiscal ${preview.period}`,
      });

      if (preview.status === 'A_PAGAR') {
        if (!settings.vatPayableAccountId) {
          throw new Error('Configure la cuenta de IVA a Pagar');
        }
        lines.push({
          accountId: settings.vatPayableAccountId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(preview.balance),
          description: `IVA a Pagar ${preview.period}`,
        });
      } else {
        if (!settings.vatBalanceAccountId) {
          throw new Error('Configure la cuenta de IVA Saldo a Favor');
        }
        lines.push({
          accountId: settings.vatBalanceAccountId,
          debit: new Prisma.Decimal(Math.abs(preview.balance)),
          credit: new Prisma.Decimal(0),
          description: `IVA Saldo a Favor ${preview.period}`,
        });
      }

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          number: nextNumber,
          date: endDate,
          description: `Liquidación IVA ${preview.period}`,
          createdBy: 'system',
          status: 'POSTED',
          postDate: new Date(),
          fiscalYearId: fiscalYear?.id,
          periodId,
          lines: { create: lines },
        },
        select: { id: true, number: true },
      });

      return entry;
    });

    logger.info('Asiento de liquidación IVA generado', {
      data: { companyId, entryId: result.id, entryNumber: result.number, year, month },
    });

    revalidatePath('/dashboard/company/accounting/entries');

    return { ...result, preview };
  } catch (error) {
    logger.error('Error al generar asiento de liquidación IVA', {
      data: { error, companyId, year, month },
    });
    throw error;
  }
}
