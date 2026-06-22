/**
 * Tipos para generación de PDFs de Remitos de Recepción
 */
import type { ThemeConfig } from '@/shared/utils/pdf-themes';

export interface ReceivingNotePDFData {
  themeConfig: ThemeConfig;
  headerText?: string | null;
  footerText?: string | null;
  notesDefault?: string | null;
  showIssuer?: boolean;
  showReceiver?: boolean;
  showNotes?: boolean;

  company: {
    name: string;
    taxId: string;
    address: string;
    phone?: string;
    email?: string;
    logoDataUri?: string;
  };

  receivingNote: {
    fullNumber: string;
    receptionDate: Date;
    status: string;
  };

  supplier: {
    businessName: string;
    tradeName?: string;
    taxId: string;
    address?: string;
    phone?: string;
    email?: string;
  };

  warehouse: {
    name: string;
  };

  // Documento origen
  sourceDocument?: {
    type: 'OC' | 'FC';
    fullNumber: string;
  };

  lines: Array<{
    productCode?: string;
    description: string;
    quantity: number;
    unitOfMeasure?: string;
    notes?: string;
  }>;

  notes?: string;

  // Documentos vinculados opcionales
  linkedDocuments?: import('@/modules/commercial/shared/pdf/linked-documents-types').LinkedDocumentsData;
}
