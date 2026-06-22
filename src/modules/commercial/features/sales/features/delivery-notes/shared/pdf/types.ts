import type { ThemeConfig } from '@/shared/utils/pdf-themes';

export interface DeliveryNotePDFData {
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

  deliveryNote: {
    fullNumber: string;
    deliveryDate: Date;
    status: string;
  };

  customer: {
    name: string;
    taxId: string | null;
    address?: string;
    phone?: string;
    email?: string;
  };

  warehouse: {
    name: string;
  };

  sourceInvoice?: {
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
}
