/**
 * Mapea datos de remito de recepción del DB al formato necesario para el PDF
 */

import type { ReceivingNotePDFData } from './types';
import type { PdfTemplateConfig } from '@/shared/utils/pdf-themes';
import { FALLBACK_THEME_CONFIG } from '@/shared/utils/pdf-themes';

type ReceivingNoteData = {
  fullNumber: string;
  receptionDate: Date;
  status: string;
  notes: string | null;
  supplier: {
    businessName: string;
    tradeName: string | null;
    taxId: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  warehouse: {
    name: string;
  };
  purchaseOrder: {
    fullNumber: string;
  } | null;
  purchaseInvoice: {
    fullNumber: string;
  } | null;
  lines: Array<{
    description: string;
    quantity: any;
    notes: string | null;
    product: {
      code: string;
      name: string;
      unitOfMeasure: string | null;
    } | null;
  }>;
};

type CompanyData = {
  name: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

export function mapReceivingNoteDataForPDF(
  note: ReceivingNoteData,
  company: CompanyData,
  logoDataUri?: string,
  config?: PdfTemplateConfig
): ReceivingNotePDFData {
  let sourceDocument: ReceivingNotePDFData['sourceDocument'];
  if (note.purchaseOrder) {
    sourceDocument = { type: 'OC', fullNumber: note.purchaseOrder.fullNumber };
  } else if (note.purchaseInvoice) {
    sourceDocument = { type: 'FC', fullNumber: note.purchaseInvoice.fullNumber };
  }

  return {
    themeConfig: config?.themeConfig ?? FALLBACK_THEME_CONFIG,
    headerText: config?.headerText,
    footerText: config?.footerText,
    notesDefault: config?.notesDefault,
    showIssuer: config?.showIssuer ?? true,
    showReceiver: config?.showReceiver ?? true,
    showNotes: config?.showNotes ?? true,
    company: {
      name: company.name,
      logoDataUri,
      taxId: company.taxId || '',
      address: company.address || '',
      phone: company.phone || undefined,
      email: company.email || undefined,
    },

    receivingNote: {
      fullNumber: note.fullNumber,
      receptionDate: note.receptionDate,
      status: note.status,
    },

    supplier: {
      businessName: note.supplier.businessName,
      tradeName: note.supplier.tradeName || undefined,
      taxId: note.supplier.taxId || '',
      address: note.supplier.address || undefined,
      phone: note.supplier.phone || undefined,
      email: note.supplier.email || undefined,
    },

    warehouse: {
      name: note.warehouse.name,
    },

    sourceDocument,

    lines: note.lines.map((line) => ({
      productCode: line.product?.code || undefined,
      description: line.description,
      quantity: Number(line.quantity),
      unitOfMeasure: line.product?.unitOfMeasure || undefined,
      notes: line.notes || undefined,
    })),

    notes: note.notes || undefined,
  };
}
