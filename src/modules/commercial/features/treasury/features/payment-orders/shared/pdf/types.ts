/**
 * Tipos para generación de PDFs de Órdenes de Pago
 */
import type { ThemeConfig } from '@/shared/utils/pdf-themes';

export interface PaymentOrderPDFData {
  // Configuración visual del template
  themeConfig: ThemeConfig;
  headerText?: string | null;
  footerText?: string | null;
  notesDefault?: string | null;
  showIssuer?: boolean;
  showReceiver?: boolean;
  showNotes?: boolean;
  showWithholdings?: boolean;

  // Datos de la empresa
  company: {
    name: string;
    taxId: string;
    address: string;
    phone?: string;
    email?: string;
    logoDataUri?: string;
  };

  // Datos de la orden de pago
  paymentOrder: {
    fullNumber: string;
    number: number;
    date: Date;
    status: string;
  };

  // Datos del proveedor
  supplier: {
    businessName: string;
    tradeName?: string;
    taxId: string;
    address?: string;
    phone?: string;
    email?: string;
  };

  // Facturas que se están pagando
  invoices: Array<{
    fullNumber: string;
    issueDate: Date;
    total: number;
    paidAmount: number;
    pendingAmount: number;
    amountToPay: number; // Monto que se paga en esta orden
  }>;

  // Formas de pago utilizadas
  payments: Array<{
    paymentMethod: string;
    amount: number;
    cashRegister?: {
      code: string;
      name: string;
    };
    bankAccount?: {
      bankName: string;
      accountNumber: string;
    };
    checkNumber?: string;
    cardLast4?: string;
    reference?: string;
  }>;

  // Total
  totalAmount: number;

  // Observaciones
  notes?: string;

  // Documentos vinculados opcionales
  linkedDocuments?: import('@/modules/commercial/shared/pdf/linked-documents-types').LinkedDocumentsData;
}
