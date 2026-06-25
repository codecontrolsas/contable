'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import { WithholdingTaxType } from '@/generated/prisma/enums';
import { revalidatePath } from 'next/cache';

// ============================================
// CRUD DE REGÍMENES DE RETENCIÓN
// ============================================

export async function getWithholdingRegimes() {
  await checkPermission('accounting.settings', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const regimes = await prisma.withholdingRegime.findMany({
      where: { companyId },
      include: {
        account: { select: { code: true, name: true } },
      },
      orderBy: [{ tax: 'asc' }, { name: 'asc' }],
    });

    return regimes.map((r) => ({
      id: r.id,
      tax: r.tax,
      jurisdiction: r.jurisdiction,
      regimeCode: r.regimeCode,
      name: r.name,
      accountId: r.accountId,
      accountCode: r.account.code,
      accountName: r.account.name,
      baseCalculation: r.baseCalculation,
      defaultRate: Number(r.defaultRate),
      minimumNotSubject: Number(r.minimumNotSubject),
      minimumRetention: Number(r.minimumRetention),
      isActive: r.isActive,
    }));
  } catch (error) {
    logger.error('Error al obtener regímenes de retención', { data: { error, companyId } });
    throw error;
  }
}

interface CreateRegimeInput {
  tax: WithholdingTaxType;
  jurisdiction?: string;
  regimeCode?: string;
  name: string;
  accountId: string;
  baseCalculation: string;
  defaultRate: number;
  minimumNotSubject: number;
  minimumRetention: number;
}

export async function createWithholdingRegime(input: CreateRegimeInput) {
  await checkPermission('accounting.settings', 'create', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const regime = await prisma.withholdingRegime.create({
      data: {
        companyId,
        tax: input.tax,
        jurisdiction: input.jurisdiction || null,
        regimeCode: input.regimeCode || null,
        name: input.name,
        accountId: input.accountId,
        baseCalculation: input.baseCalculation,
        defaultRate: input.defaultRate,
        minimumNotSubject: input.minimumNotSubject,
        minimumRetention: input.minimumRetention,
      },
      select: { id: true },
    });

    logger.info('Régimen de retención creado', { data: { companyId, regimeId: regime.id } });
    revalidatePath('/dashboard/company/accounting/settings');

    return regime;
  } catch (error) {
    logger.error('Error al crear régimen de retención', { data: { error, companyId } });
    throw error;
  }
}

export async function updateWithholdingRegime(id: string, input: Partial<CreateRegimeInput>) {
  await checkPermission('accounting.settings', 'update', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    await prisma.withholdingRegime.update({
      where: { id },
      data: {
        ...(input.tax !== undefined && { tax: input.tax }),
        ...(input.jurisdiction !== undefined && { jurisdiction: input.jurisdiction || null }),
        ...(input.regimeCode !== undefined && { regimeCode: input.regimeCode || null }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.accountId !== undefined && { accountId: input.accountId }),
        ...(input.baseCalculation !== undefined && { baseCalculation: input.baseCalculation }),
        ...(input.defaultRate !== undefined && { defaultRate: input.defaultRate }),
        ...(input.minimumNotSubject !== undefined && { minimumNotSubject: input.minimumNotSubject }),
        ...(input.minimumRetention !== undefined && { minimumRetention: input.minimumRetention }),
      },
    });

    logger.info('Régimen de retención actualizado', { data: { companyId, regimeId: id } });
    revalidatePath('/dashboard/company/accounting/settings');
  } catch (error) {
    logger.error('Error al actualizar régimen de retención', { data: { error, companyId, id } });
    throw error;
  }
}

export async function toggleWithholdingRegime(id: string) {
  await checkPermission('accounting.settings', 'update', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const regime = await prisma.withholdingRegime.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!regime) throw new Error('Régimen no encontrado');

    await prisma.withholdingRegime.update({
      where: { id },
      data: { isActive: !regime.isActive },
    });

    logger.info('Régimen de retención toggled', {
      data: { companyId, regimeId: id, newState: !regime.isActive },
    });
    revalidatePath('/dashboard/company/accounting/settings');
  } catch (error) {
    logger.error('Error al toggle régimen', { data: { error, companyId, id } });
    throw error;
  }
}

// ============================================
// CÁLCULO AUTOMÁTICO DE RETENCIONES
// ============================================

interface CalculatedWithholding {
  regimeId: string;
  regimeName: string;
  tax: WithholdingTaxType;
  jurisdiction: string | null;
  rate: number;
  base: number;
  amount: number;
}

export async function calculateWithholdings(
  supplierId: string,
  invoiceAmounts: { subtotal: number; total: number }[]
): Promise<CalculatedWithholding[]> {
  await checkPermission('commercial.payment-orders', 'create', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { taxId: true },
    });

    if (!supplier) throw new Error('Proveedor no encontrado');

    const regimes = await prisma.withholdingRegime.findMany({
      where: { companyId, isActive: true },
      orderBy: { tax: 'asc' },
    });

    if (regimes.length === 0) return [];

    const now = new Date();

    // Buscar alícuotas del padrón para este proveedor
    const padronRates = await prisma.taxRatePadron.findMany({
      where: {
        companyId,
        taxId: supplier.taxId,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
    });

    const padronMap = new Map(
      padronRates.map((p) => [`${p.tax}-${p.jurisdiction ?? ''}`, p])
    );

    const totalSubtotal = invoiceAmounts.reduce((s, a) => s + a.subtotal, 0);
    const totalTotal = invoiceAmounts.reduce((s, a) => s + a.total, 0);

    const results: CalculatedWithholding[] = [];

    for (const regime of regimes) {
      const base = regime.baseCalculation === 'NET' ? totalSubtotal : totalTotal;

      if (base < Number(regime.minimumNotSubject)) continue;

      // Buscar alícuota del padrón
      const padronKey = `${regime.tax}-${regime.jurisdiction ?? ''}`;
      const padron = padronMap.get(padronKey);
      const rate = padron?.retentionRate
        ? Number(padron.retentionRate)
        : Number(regime.defaultRate);

      const amount = Math.round(base * (rate / 100) * 100) / 100;

      if (amount < Number(regime.minimumRetention)) continue;

      results.push({
        regimeId: regime.id,
        regimeName: regime.name,
        tax: regime.tax,
        jurisdiction: regime.jurisdiction,
        rate,
        base,
        amount,
      });
    }

    return results;
  } catch (error) {
    logger.error('Error al calcular retenciones', {
      data: { error, companyId, supplierId },
    });
    throw error;
  }
}

// ============================================
// IMPORTACIÓN DE PADRONES
// ============================================

interface PadronEntry {
  taxId: string;
  tax: WithholdingTaxType;
  jurisdiction?: string;
  perceptionRate?: number;
  retentionRate?: number;
  validFrom: Date;
  validTo: Date;
}

export async function importTaxRatePadron(entries: PadronEntry[]) {
  await checkPermission('accounting.settings', 'create', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = await prisma.taxRatePadron.findUnique({
        where: {
          companyId_taxId_tax_jurisdiction_validFrom: {
            companyId,
            taxId: entry.taxId,
            tax: entry.tax,
            jurisdiction: entry.jurisdiction ?? '',
            validFrom: entry.validFrom,
          },
        },
      });

      if (existing) {
        await prisma.taxRatePadron.update({
          where: { id: existing.id },
          data: {
            perceptionRate: entry.perceptionRate ?? null,
            retentionRate: entry.retentionRate ?? null,
            validTo: entry.validTo,
          },
        });
        updated++;
      } else {
        await prisma.taxRatePadron.create({
          data: {
            companyId,
            taxId: entry.taxId,
            tax: entry.tax,
            jurisdiction: entry.jurisdiction ?? null,
            perceptionRate: entry.perceptionRate ?? null,
            retentionRate: entry.retentionRate ?? null,
            validFrom: entry.validFrom,
            validTo: entry.validTo,
          },
        });
        created++;
      }
    }

    logger.info('Padrón importado', {
      data: { companyId, total: entries.length, created, updated },
    });

    return { total: entries.length, created, updated };
  } catch (error) {
    logger.error('Error al importar padrón', {
      data: { error, companyId, entryCount: entries.length },
    });
    throw error;
  }
}
