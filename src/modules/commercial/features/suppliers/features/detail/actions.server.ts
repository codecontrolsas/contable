'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/shared/lib/prisma';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import type { Prisma } from '@prisma/client';
import { isCreditNote } from '@/modules/commercial/shared/voucher-utils';

/**
 * Obtiene el detalle completo del proveedor con su cuenta corriente
 */
export async function getSupplierAccountStatement(supplierId: string) {
  await checkPermission('commercial.suppliers', 'view', { redirect: true });
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('No autenticado');

    const companyId = await getActiveCompanyId();
    if (!companyId) throw new Error('No hay empresa activa');

    // Verificar que el proveedor existe y pertenece a la empresa
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
      select: { id: true, businessName: true },
    });

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    // Obtener facturas de compra
    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      where: {
        supplierId,
        companyId,
        status: { in: ['CONFIRMED', 'PAID', 'PARTIAL_PAID'] },
      },
      select: {
        id: true,
        fullNumber: true,
        voucherType: true,
        issueDate: true,
        dueDate: true,
        total: true,
        status: true,
        paymentOrderItems: {
          where: {
            paymentOrder: {
              status: 'CONFIRMED', // Solo pagos confirmados
            },
          },
          select: {
            amount: true,
            paymentOrder: {
              select: {
                fullNumber: true,
                date: true,
              },
            },
          },
        },
        creditNoteApplicationsReceived: {
          select: {
            amount: true,
            creditNoteId: true,
            creditNote: {
              select: {
                fullNumber: true,
              },
            },
          },
        },
        creditNoteApplicationsGiven: {
          select: {
            amount: true,
            invoice: {
              select: {
                fullNumber: true,
              },
            },
          },
        },
        creditDebitNotes: {
          select: {
            id: true,
            voucherType: true,
            total: true,
            status: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    // Obtener órdenes de pago
    const paymentOrders = await prisma.paymentOrder.findMany({
      where: {
        supplierId,
        companyId,
        status: 'CONFIRMED', // Solo pagos confirmados
      },
      select: {
        id: true,
        fullNumber: true,
        date: true,
        totalAmount: true,
        status: true,
        items: {
          select: {
            amount: true,
            invoice: {
              select: {
                fullNumber: true,
                issueDate: true,
              },
            },
          },
        },
        withholdings: {
          select: {
            amount: true,
            taxType: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calcular saldos
    const invoicesWithBalance = purchaseInvoices.map((invoice) => {
      const isNC = isCreditNote(invoice.voucherType);

      const totalPayments = invoice.paymentOrderItems.reduce(
        (sum: number, item: { amount: unknown }) => sum + Number(item.amount),
        0
      );

      // NC aplicadas explícitamente (tabla PurchaseCreditNoteApplication)
      const cnAppliedToThisExplicit = invoice.creditNoteApplicationsReceived.reduce(
        (sum, app) => sum + Number(app.amount),
        0
      );

      // Fallback: NC vinculadas por originalInvoiceId sin registro explícito
      // Capear para que pagado no supere el total de la factura
      const explicitCNIds = new Set(
        invoice.creditNoteApplicationsReceived.map((app) => app.creditNoteId)
      );
      const cnLinkedRaw = !isNC
        ? invoice.creditDebitNotes
            .filter(
              (doc) =>
                isCreditNote(doc.voucherType) &&
                doc.status !== 'DRAFT' &&
                doc.status !== 'CANCELLED' &&
                !explicitCNIds.has(doc.id)
            )
            .reduce((sum, doc) => sum + Number(doc.total), 0)
        : 0;
      const maxFallbackNC = Math.max(0, Number(invoice.total) - totalPayments - cnAppliedToThisExplicit);
      const cnLinkedToThis = Math.min(cnLinkedRaw, maxFallbackNC);

      const cnAppliedToThis = cnAppliedToThisExplicit + cnLinkedToThis;

      const cnAppliedFromThis = invoice.creditNoteApplicationsGiven.reduce(
        (sum, app) => sum + Number(app.amount),
        0
      );

      // NC: saldo restante no aplicado (negativo = crédito disponible)
      // Factura/ND: total - pagado - NC aplicadas
      const totalPaid = isNC ? cnAppliedFromThis : totalPayments + cnAppliedToThis;
      const balance = isNC
        ? -(Number(invoice.total) - cnAppliedFromThis)
        : Number(invoice.total) - totalPayments - cnAppliedToThis;

      return {
        id: invoice.id,
        fullNumber: invoice.fullNumber,
        voucherType: invoice.voucherType,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total: Number(invoice.total),
        paid: totalPaid,
        balance,
        status: invoice.status,
        payments: invoice.paymentOrderItems.map((item) => ({
          amount: Number(item.amount),
          paymentOrderNumber: item.paymentOrder.fullNumber,
          paymentDate: item.paymentOrder.date,
        })),
      };
    });

    const paymentsFormatted = paymentOrders.map((payment) => ({
      id: payment.id,
      fullNumber: payment.fullNumber,
      date: payment.date,
      totalAmount: Number(payment.totalAmount),
      status: payment.status,
      withholdingsTotal: payment.withholdings.reduce((sum, w) => sum + Number(w.amount), 0),
      invoices: payment.items.map((item) => ({
        amount: Number(item.amount),
        invoiceNumber: item.invoice.fullNumber,
        invoiceDate: item.invoice.issueDate,
      })),
    }));

    // Calcular totales: Facturado (Facturas + ND), Pagado (Pagos + NC aplicadas), Saldo
    const totalInvoiced = invoicesWithBalance
      .filter((inv) => !isCreditNote(inv.voucherType))
      .reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoicesWithBalance
      .filter((inv) => !isCreditNote(inv.voucherType))
      .reduce((sum, inv) => sum + inv.paid, 0);
    const totalBalance = totalInvoiced - totalPaid;

    logger.info('Cuenta corriente de proveedor obtenida', {
      data: { supplierId, companyId, invoiceCount: invoicesWithBalance.length },
    });

    return {
      supplier: {
        id: supplier.id,
        businessName: supplier.businessName,
      },
      invoices: invoicesWithBalance,
      payments: paymentsFormatted,
      summary: {
        totalInvoiced,
        totalPaid,
        totalBalance,
      },
    };
  } catch (error) {
    logger.error('Error al obtener cuenta corriente de proveedor', {
      data: { supplierId, error },
    });
    throw error;
  }
}

export type SupplierAccountStatement = Awaited<ReturnType<typeof getSupplierAccountStatement>>;
export type SupplierInvoiceWithBalance = SupplierAccountStatement['invoices'][number];
export type SupplierPayment = SupplierAccountStatement['payments'][number];
