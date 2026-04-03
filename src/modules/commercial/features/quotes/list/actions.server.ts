'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import { createQuoteSchema } from '../shared/validators';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildFiltersWhere,
  buildDateRangeFiltersWhere,
  buildTextFiltersWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import moment from 'moment';

// ============================================
// CALCULATION HELPERS
// ============================================

function calculateLineAmounts(
  quantity: number,
  unitPrice: number,
  vatRate: number,
  discountPercent: number | null,
  discountAmount: number | null,
): {
  baseAmount: number;
  discountValue: number;
  subtotal: number;
  vatAmount: number;
  total: number;
} {
  const baseAmount = quantity * unitPrice;

  let discountValue = 0;
  if (discountPercent != null && discountPercent > 0) {
    discountValue = baseAmount * (discountPercent / 100);
  } else if (discountAmount != null && discountAmount > 0) {
    discountValue = Math.min(discountAmount, baseAmount);
  }

  const subtotal = baseAmount - discountValue;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    discountValue: Math.round(discountValue * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

function calculateGlobalDiscount(
  sumLineSubtotals: number,
  globalDiscountPercent: number | null,
  globalDiscountAmount: number | null,
): number {
  if (globalDiscountPercent != null && globalDiscountPercent > 0) {
    return Math.round(sumLineSubtotals * (globalDiscountPercent / 100) * 100) / 100;
  }
  if (globalDiscountAmount != null && globalDiscountAmount > 0) {
    return Math.round(Math.min(globalDiscountAmount, sumLineSubtotals) * 100) / 100;
  }
  return 0;
}

function calculateQuoteTotalsWithGlobalDiscount(
  linesData: Array<{ subtotal: number; vatRate: number }>,
  globalDiscount: number,
): { quoteSubtotal: number; quoteVatAmount: number } {
  const sumLineSubtotals = linesData.reduce((acc, l) => acc + l.subtotal, 0);

  if (globalDiscount <= 0 || sumLineSubtotals <= 0) {
    return {
      quoteSubtotal: sumLineSubtotals,
      quoteVatAmount: linesData.reduce(
        (acc, l) => acc + l.subtotal * (l.vatRate / 100),
        0,
      ),
    };
  }

  let quoteVatAmount = 0;
  for (const line of linesData) {
    const weight = line.subtotal / sumLineSubtotals;
    const lineGlobalDiscount = globalDiscount * weight;
    const discountedBase = line.subtotal - lineGlobalDiscount;
    quoteVatAmount += discountedBase * (line.vatRate / 100);
  }

  return {
    quoteSubtotal: Math.round((sumLineSubtotals - globalDiscount) * 100) / 100,
    quoteVatAmount: Math.round(quoteVatAmount * 100) / 100,
  };
}

// ============================================
// AUTO-EXPIRE OVERDUE QUOTES
// ============================================

async function checkExpiredQuotes(companyId: string) {
  try {
    const now = moment().startOf('day').toDate();

    const result = await prisma.quote.updateMany({
      where: {
        companyId,
        status: { in: ['SENT', 'ACCEPTED'] },
        expirationDate: { lt: now, not: null },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      logger.info('Presupuestos expirados automáticamente', {
        data: { companyId, count: result.count },
      });
    }
  } catch (error) {
    logger.error('Error al verificar presupuestos expirados', {
      data: { companyId, error },
    });
  }
}

// ============================================
// QUERIES
// ============================================

// Obtener presupuestos con paginación server-side para DataTable
export async function getQuotesPaginated(searchParams: DataTableSearchParams) {
  await checkPermission('commercial.quotes', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Auto-expirar presupuestos vencidos
    await checkExpiredQuotes(companyId);

    const parsed = parseSearchParams(searchParams);
    const { skip, take, orderBy: prismaOrderBy } = stateToPrismaParams(parsed);

    const filtersWhere = buildFiltersWhere(
      parsed.filters,
      { status: 'status' },
      { exclude: ['issueDate', 'number', 'contractor_name', 'lead_name'] },
    );

    const dateFiltersWhere = buildDateRangeFiltersWhere(parsed.filters, ['issueDate']);
    const textFiltersWhere = buildTextFiltersWhere(parsed.filters, ['number']);

    // Filtro de texto para cliente (relación anidada)
    const contractorNameFilter = parsed.filters['contractor_name'];
    const contractorWhere = contractorNameFilter?.[0]
      ? { contractor: { name: { contains: contractorNameFilter[0], mode: 'insensitive' as const } } }
      : {};

    // Filtro de texto para lead (relación anidada)
    const leadNameFilter = parsed.filters['lead_name'];
    const leadWhere = leadNameFilter?.[0]
      ? { lead: { name: { contains: leadNameFilter[0], mode: 'insensitive' as const } } }
      : {};

    // Búsqueda general por número o nombre de cliente/lead
    const searchWhere = parsed.search
      ? {
          OR: [
            { number: { contains: parsed.search, mode: 'insensitive' as const } },
            { contractor: { name: { contains: parsed.search, mode: 'insensitive' as const } } },
            { lead: { name: { contains: parsed.search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const where: Prisma.QuoteWhereInput = {
      companyId,
      ...filtersWhere,
      ...dateFiltersWhere,
      ...textFiltersWhere,
      ...contractorWhere,
      ...leadWhere,
      ...searchWhere,
    };

    const orderBy =
      prismaOrderBy && Object.keys(prismaOrderBy).length > 0
        ? prismaOrderBy
        : [{ createdAt: 'desc' as const }];

    const [data, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        select: {
          id: true,
          number: true,
          issueDate: true,
          expirationDate: true,
          status: true,
          subtotal: true,
          vatAmount: true,
          total: true,
          currency: true,
          contractor: {
            select: {
              id: true,
              name: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
        skip,
        take,
      }),
      prisma.quote.count({ where }),
    ]);

    return {
      data: data.map((quote) => ({
        ...quote,
        subtotal: Number(quote.subtotal),
        vatAmount: Number(quote.vatAmount),
        total: Number(quote.total),
      })),
      total,
    };
  } catch (error) {
    logger.error('Error al obtener presupuestos paginados', { data: { error } });
    throw error;
  }
}

// Obtener conteos globales para filtros facetados
export async function getQuoteFacetCounts() {
  await checkPermission('commercial.quotes', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  const statusCounts = await prisma.quote.groupBy({
    by: ['status'],
    where: { companyId },
    _count: { status: true },
  });

  return {
    status: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status])),
  };
}

// Obtener presupuesto por ID
export async function getQuoteById(id: string) {
  await checkPermission('commercial.quotes', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const quote = await prisma.quote.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        contractor: {
          select: {
            id: true,
            name: true,
            taxId: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        lines: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                unitOfMeasure: true,
              },
            },
          },
        },
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!quote) {
      throw new Error('Presupuesto no encontrado');
    }

    // Auto-expirar si está vencido
    if (
      quote.expirationDate &&
      moment(quote.expirationDate).isBefore(moment(), 'day') &&
      (quote.status === 'SENT' || quote.status === 'ACCEPTED')
    ) {
      await prisma.quote.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      quote.status = 'EXPIRED';
    }

    // Convertir Decimals a Numbers para Client Components
    return {
      ...quote,
      subtotal: Number(quote.subtotal),
      vatAmount: Number(quote.vatAmount),
      total: Number(quote.total),
      globalDiscountPercent: quote.globalDiscountPercent
        ? Number(quote.globalDiscountPercent)
        : null,
      globalDiscountAmount: quote.globalDiscountAmount
        ? Number(quote.globalDiscountAmount)
        : null,
      totalBeforeDiscount: Number(quote.totalBeforeDiscount),
      discountTotal: Number(quote.discountTotal),
      lines: quote.lines.map((line) => ({
        ...line,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        vatRate: Number(line.vatRate),
        vatAmount: Number(line.vatAmount),
        subtotal: Number(line.subtotal),
        total: Number(line.total),
        discountPercent: line.discountPercent ? Number(line.discountPercent) : null,
        discountAmount: line.discountAmount ? Number(line.discountAmount) : null,
        deliveredQty: Number(line.deliveredQty),
        invoicedQty: Number(line.invoicedQty),
      })),
    };
  } catch (error) {
    logger.error('Error al obtener presupuesto', {
      data: { id, companyId, error },
    });
    throw new Error('Error al obtener el presupuesto');
  }
}

// Obtener próximo número de presupuesto
export async function getNextQuoteNumber(): Promise<string> {
  await checkPermission('commercial.quotes', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const lastQuote = await prisma.quote.findFirst({
      where: { companyId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    // Extract the numeric part from "P-0001" format
    let nextNum = 1;
    if (lastQuote) {
      const match = lastQuote.number.match(/(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    return `P-${nextNum.toString().padStart(4, '0')}`;
  } catch (error) {
    logger.error('Error al obtener próximo número de presupuesto', {
      data: { companyId, error },
    });
    throw new Error('Error al obtener el próximo número');
  }
}

// ============================================
// MUTATIONS
// ============================================

// Crear presupuesto
export async function createQuote(data: unknown) {
  await checkPermission('commercial.quotes', 'create', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const validatedData = createQuoteSchema.parse(data);

    // Determinar contractorId o leadId según recipientType
    const contractorId =
      validatedData.recipientType === 'customer' && validatedData.customerId
        ? validatedData.customerId
        : null;
    const leadId =
      validatedData.recipientType === 'lead' && validatedData.leadId
        ? validatedData.leadId
        : null;

    // Verificar que el destinatario existe
    if (contractorId) {
      const contractor = await prisma.contractor.findFirst({
        where: { id: contractorId, companyId },
      });
      if (!contractor) throw new Error('Cliente no encontrado');
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, companyId },
      });
      if (!lead) throw new Error('Lead no encontrado');
    }

    // Obtener próximo número
    const nextNumber = await getNextQuoteNumber();

    // Calcular totales de líneas
    let totalLineDiscounts = 0;

    const linesData = validatedData.lines.map((line) => {
      const amounts = calculateLineAmounts(
        line.quantity,
        line.unitPrice,
        line.vatRate,
        line.discountPercent,
        line.discountAmount,
      );

      totalLineDiscounts += amounts.discountValue;

      return {
        productId: line.productId,
        description: line.description,
        quantity: new Prisma.Decimal(line.quantity),
        unitPrice: new Prisma.Decimal(line.unitPrice),
        vatRate: new Prisma.Decimal(line.vatRate),
        vatAmount: new Prisma.Decimal(amounts.vatAmount),
        subtotal: new Prisma.Decimal(amounts.subtotal),
        total: new Prisma.Decimal(amounts.total),
        discountPercent:
          line.discountPercent != null
            ? new Prisma.Decimal(line.discountPercent)
            : null,
        discountAmount:
          line.discountAmount != null
            ? new Prisma.Decimal(line.discountAmount)
            : null,
      };
    });

    const sumLineSubtotals = linesData.reduce(
      (acc, l) => acc + Number(l.subtotal),
      0,
    );

    const globalDiscount = calculateGlobalDiscount(
      sumLineSubtotals,
      validatedData.globalDiscountPercent,
      validatedData.globalDiscountAmount,
    );

    const { quoteSubtotal, quoteVatAmount } =
      calculateQuoteTotalsWithGlobalDiscount(
        validatedData.lines.map((line, i) => ({
          subtotal: Number(linesData[i].subtotal),
          vatRate: line.vatRate,
        })),
        globalDiscount,
      );

    const quoteTotal = quoteSubtotal + quoteVatAmount;
    const totalBeforeDiscount = sumLineSubtotals;
    const discountTotal = totalLineDiscounts + globalDiscount;

    // Crear presupuesto en transacción
    const quote = await prisma.$transaction(async (tx) => {
      const newQuote = await tx.quote.create({
        data: {
          companyId,
          contractorId,
          leadId,
          number: nextNumber,
          issueDate: validatedData.issueDate,
          expirationDate: validatedData.expirationDate || null,
          currency: validatedData.currency,
          subtotal: new Prisma.Decimal(quoteSubtotal),
          vatAmount: new Prisma.Decimal(quoteVatAmount),
          total: new Prisma.Decimal(quoteTotal),
          globalDiscountPercent:
            validatedData.globalDiscountPercent != null
              ? new Prisma.Decimal(validatedData.globalDiscountPercent)
              : null,
          globalDiscountAmount:
            validatedData.globalDiscountAmount != null
              ? new Prisma.Decimal(validatedData.globalDiscountAmount)
              : null,
          totalBeforeDiscount: new Prisma.Decimal(totalBeforeDiscount),
          discountTotal: new Prisma.Decimal(discountTotal),
          notes: validatedData.notes || null,
          conditions: validatedData.conditions || null,
          status: 'DRAFT',
          createdBy: authUserId,
          lines: {
            create: linesData,
          },
        },
      });

      return newQuote;
    });

    logger.info('Presupuesto creado', {
      data: {
        quoteId: quote.id,
        number: quote.number,
        total: quote.total.toString(),
        companyId,
      },
    });

    revalidatePath('/dashboard/commercial/quotes');

    return { success: true, id: quote.id };
  } catch (error) {
    logger.error('Error al crear presupuesto', {
      data: { companyId, error },
    });
    throw error;
  }
}

// Actualizar presupuesto (solo en estado DRAFT)
export async function updateQuote(id: string, data: unknown) {
  await checkPermission('commercial.quotes', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que existe y está en DRAFT
    const existing = await prisma.quote.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });

    if (!existing) throw new Error('Presupuesto no encontrado');
    if (existing.status !== 'DRAFT') {
      throw new Error('Solo se pueden editar presupuestos en estado Borrador');
    }

    const validatedData = createQuoteSchema.parse(data);

    // Determinar contractorId o leadId según recipientType
    const contractorId =
      validatedData.recipientType === 'customer' && validatedData.customerId
        ? validatedData.customerId
        : null;
    const leadId =
      validatedData.recipientType === 'lead' && validatedData.leadId
        ? validatedData.leadId
        : null;

    // Verificar que el destinatario existe
    if (contractorId) {
      const contractor = await prisma.contractor.findFirst({
        where: { id: contractorId, companyId },
      });
      if (!contractor) throw new Error('Cliente no encontrado');
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, companyId },
      });
      if (!lead) throw new Error('Lead no encontrado');
    }

    // Calcular totales de líneas
    let totalLineDiscounts = 0;

    const linesData = validatedData.lines.map((line) => {
      const amounts = calculateLineAmounts(
        line.quantity,
        line.unitPrice,
        line.vatRate,
        line.discountPercent,
        line.discountAmount,
      );

      totalLineDiscounts += amounts.discountValue;

      return {
        productId: line.productId,
        description: line.description,
        quantity: new Prisma.Decimal(line.quantity),
        unitPrice: new Prisma.Decimal(line.unitPrice),
        vatRate: new Prisma.Decimal(line.vatRate),
        vatAmount: new Prisma.Decimal(amounts.vatAmount),
        subtotal: new Prisma.Decimal(amounts.subtotal),
        total: new Prisma.Decimal(amounts.total),
        discountPercent:
          line.discountPercent != null
            ? new Prisma.Decimal(line.discountPercent)
            : null,
        discountAmount:
          line.discountAmount != null
            ? new Prisma.Decimal(line.discountAmount)
            : null,
      };
    });

    const sumLineSubtotals = linesData.reduce(
      (acc, l) => acc + Number(l.subtotal),
      0,
    );

    const globalDiscount = calculateGlobalDiscount(
      sumLineSubtotals,
      validatedData.globalDiscountPercent,
      validatedData.globalDiscountAmount,
    );

    const { quoteSubtotal, quoteVatAmount } =
      calculateQuoteTotalsWithGlobalDiscount(
        validatedData.lines.map((line, i) => ({
          subtotal: Number(linesData[i].subtotal),
          vatRate: line.vatRate,
        })),
        globalDiscount,
      );

    const quoteTotal = quoteSubtotal + quoteVatAmount;
    const totalBeforeDiscount = sumLineSubtotals;
    const discountTotal = totalLineDiscounts + globalDiscount;

    // Actualizar en transacción: borrar líneas existentes y recrear
    await prisma.$transaction(async (tx) => {
      await tx.quoteLine.deleteMany({ where: { quoteId: id } });

      await tx.quote.update({
        where: { id },
        data: {
          contractorId,
          leadId,
          issueDate: validatedData.issueDate,
          expirationDate: validatedData.expirationDate || null,
          currency: validatedData.currency,
          subtotal: new Prisma.Decimal(quoteSubtotal),
          vatAmount: new Prisma.Decimal(quoteVatAmount),
          total: new Prisma.Decimal(quoteTotal),
          globalDiscountPercent:
            validatedData.globalDiscountPercent != null
              ? new Prisma.Decimal(validatedData.globalDiscountPercent)
              : null,
          globalDiscountAmount:
            validatedData.globalDiscountAmount != null
              ? new Prisma.Decimal(validatedData.globalDiscountAmount)
              : null,
          totalBeforeDiscount: new Prisma.Decimal(totalBeforeDiscount),
          discountTotal: new Prisma.Decimal(discountTotal),
          notes: validatedData.notes || null,
          conditions: validatedData.conditions || null,
          lines: {
            create: linesData,
          },
        },
      });
    });

    logger.info('Presupuesto actualizado', {
      data: { quoteId: id, companyId },
    });

    revalidatePath('/dashboard/commercial/quotes');
    revalidatePath(`/dashboard/commercial/quotes/${id}`);

    return { success: true, id };
  } catch (error) {
    logger.error('Error al actualizar presupuesto', {
      data: { id, companyId, error },
    });
    throw error;
  }
}

// Eliminar presupuesto (solo en estado DRAFT)
export async function deleteQuote(id: string) {
  await checkPermission('commercial.quotes', 'delete', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const existing = await prisma.quote.findFirst({
      where: { id, companyId },
      select: { id: true, status: true, number: true },
    });

    if (!existing) throw new Error('Presupuesto no encontrado');
    if (existing.status !== 'DRAFT') {
      throw new Error('Solo se pueden eliminar presupuestos en estado Borrador');
    }

    // Cascade will handle lines
    await prisma.quote.delete({ where: { id } });

    logger.info('Presupuesto eliminado', {
      data: { quoteId: id, number: existing.number, companyId },
    });

    revalidatePath('/dashboard/commercial/quotes');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar presupuesto', {
      data: { id, companyId, error },
    });
    throw error;
  }
}

// Cambiar estado de presupuesto
export async function updateQuoteStatus(id: string, newStatus: string) {
  // Para ACCEPTED usar permiso 'approve', para el resto 'update'
  if (newStatus === 'ACCEPTED') {
    await checkPermission('commercial.quotes', 'approve', { redirect: true });
  } else {
    await checkPermission('commercial.quotes', 'update', { redirect: true });
  }

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const quote = await prisma.quote.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        status: true,
        contractorId: true,
        leadId: true,
        lines: { select: { id: true } },
      },
    });

    if (!quote) throw new Error('Presupuesto no encontrado');

    // Validar transiciones permitidas
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['SENT'],
      SENT: ['ACCEPTED', 'REJECTED'],
    };

    const allowed = validTransitions[quote.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `No se puede cambiar de ${quote.status} a ${newStatus}`,
      );
    }

    // Validaciones específicas por transición
    if (newStatus === 'SENT') {
      if (!quote.contractorId && !quote.leadId) {
        throw new Error(
          'Debe asignar un cliente o lead antes de enviar el presupuesto',
        );
      }
      if (quote.lines.length === 0) {
        throw new Error(
          'Debe agregar al menos una línea antes de enviar el presupuesto',
        );
      }
    }

    await prisma.quote.update({
      where: { id },
      data: { status: newStatus as Prisma.EnumQuoteStatusFieldUpdateOperationsInput['set'] },
    });

    logger.info('Estado de presupuesto actualizado', {
      data: {
        quoteId: id,
        from: quote.status,
        to: newStatus,
        companyId,
      },
    });

    revalidatePath('/dashboard/commercial/quotes');
    revalidatePath(`/dashboard/commercial/quotes/${id}`);

    return { success: true };
  } catch (error) {
    logger.error('Error al cambiar estado de presupuesto', {
      data: { id, newStatus, companyId, error },
    });
    throw error;
  }
}

// Duplicar presupuesto
export async function duplicateQuote(id: string) {
  await checkPermission('commercial.quotes', 'create', { redirect: true });
  const { userId: authUserId } = await auth();
  if (!authUserId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const original = await prisma.quote.findFirst({
      where: { id, companyId },
      include: {
        lines: true,
      },
    });

    if (!original) throw new Error('Presupuesto no encontrado');

    // Obtener próximo número
    const nextNumber = await getNextQuoteNumber();

    const newQuote = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          companyId,
          contractorId: original.contractorId,
          leadId: original.leadId,
          number: nextNumber,
          issueDate: moment().toDate(),
          expirationDate: original.expirationDate
            ? moment()
                .add(
                  moment(original.expirationDate).diff(
                    moment(original.issueDate),
                    'days',
                  ),
                  'days',
                )
                .toDate()
            : null,
          currency: original.currency,
          subtotal: original.subtotal,
          vatAmount: original.vatAmount,
          total: original.total,
          globalDiscountPercent: original.globalDiscountPercent,
          globalDiscountAmount: original.globalDiscountAmount,
          totalBeforeDiscount: original.totalBeforeDiscount,
          discountTotal: original.discountTotal,
          notes: original.notes,
          conditions: original.conditions,
          status: 'DRAFT',
          createdBy: authUserId,
          lines: {
            create: original.lines.map((line) => ({
              productId: line.productId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              vatRate: line.vatRate,
              vatAmount: line.vatAmount,
              subtotal: line.subtotal,
              total: line.total,
              discountPercent: line.discountPercent,
              discountAmount: line.discountAmount,
            })),
          },
        },
      });

      return created;
    });

    logger.info('Presupuesto duplicado', {
      data: {
        originalId: id,
        newId: newQuote.id,
        newNumber: newQuote.number,
        companyId,
      },
    });

    revalidatePath('/dashboard/commercial/quotes');

    return { success: true, id: newQuote.id };
  } catch (error) {
    logger.error('Error al duplicar presupuesto', {
      data: { id, companyId, error },
    });
    throw error;
  }
}
