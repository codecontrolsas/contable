import type { ThemeConfig } from '@/shared/utils/pdf-themes';

export interface StockTransferPDFData {
  themeConfig: ThemeConfig;
  headerText?: string | null;
  footerText?: string | null;
  notesDefault?: string | null;
  showIssuer?: boolean;
  showNotes?: boolean;

  company: {
    name: string;
    taxId: string;
    address: string;
    logoDataUri?: string;
  };

  transfer: {
    transferNumber: string;
    date: Date;
    notes?: string | null;
  };

  sourceWarehouse: {
    code: string;
    name: string;
  };

  destinationWarehouse: {
    code: string;
    name: string;
  };

  lines: Array<{
    productCode: string;
    productName: string;
    unit?: string;
    quantity: number;
  }>;
}
