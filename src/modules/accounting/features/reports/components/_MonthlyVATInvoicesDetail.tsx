'use client';

import moment from 'moment';
import { Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { exportToExcel, type ExcelColumn } from '@/shared/lib/excel-export';
import type { VoucherType } from '@/generated/prisma/enums';
import { formatAmount } from '../../../shared/utils';
import type { VATInvoiceDetail } from '../actions.server';

const VOUCHER_SHORT_LABELS: Record<VoucherType, string> = {
  FACTURA_A: 'Fact. A',
  FACTURA_B: 'Fact. B',
  FACTURA_C: 'Fact. C',
  NOTA_CREDITO_A: 'NC A',
  NOTA_CREDITO_B: 'NC B',
  NOTA_CREDITO_C: 'NC C',
  NOTA_DEBITO_A: 'ND A',
  NOTA_DEBITO_B: 'ND B',
  NOTA_DEBITO_C: 'ND C',
  RECIBO: 'Recibo',
};

type BookKind = 'sales' | 'purchases';

interface MonthlyVATInvoicesDetailProps {
  salesInvoices: VATInvoiceDetail[];
  purchaseInvoices: VATInvoiceDetail[];
  periodLabel: string;
  filePeriod: string;
}

function sumBy(rows: VATInvoiceDetail[], key: 'subtotal' | 'vatAmount' | 'otherTaxes' | 'total') {
  return rows.reduce((acc, row) => acc + row[key], 0);
}

function amountClass(value: number) {
  return value < 0 ? 'text-red-600 dark:text-red-400' : '';
}

function InvoicesTable({ rows, kind }: { rows: VATInvoiceDetail[]; kind: BookKind }) {
  const counterpartyTitle = kind === 'sales' ? 'Cliente' : 'Proveedor';

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="py-3 pl-4 text-left">Fecha</th>
            <th className="py-3 text-left">Comprobante</th>
            <th className="py-3 text-left">{counterpartyTitle}</th>
            <th className="py-3 text-right">Neto</th>
            <th className="py-3 text-right">IVA</th>
            <th className="py-3 text-right">Otros Imp.</th>
            <th className="py-3 pr-4 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                No hay comprobantes en el periodo seleccionado
              </td>
            </tr>
          ) : (
            <>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2 pl-4 whitespace-nowrap">
                    {moment(row.issueDate).format('DD/MM/YYYY')}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="text-muted-foreground">{VOUCHER_SHORT_LABELS[row.voucherType]}</span>{' '}
                    <span className="font-mono">{row.fullNumber}</span>
                  </td>
                  <td className="max-w-[240px]">
                    <div className="truncate font-medium">{row.counterpartyName}</div>
                    {row.counterpartyTaxId && (
                      <div className="font-mono text-xs text-muted-foreground">{row.counterpartyTaxId}</div>
                    )}
                  </td>
                  <td className={`text-right ${amountClass(row.subtotal)}`}>{formatAmount(row.subtotal)}</td>
                  <td className={`text-right ${amountClass(row.vatAmount)}`}>{formatAmount(row.vatAmount)}</td>
                  <td className={`text-right ${amountClass(row.otherTaxes)}`}>{formatAmount(row.otherTaxes)}</td>
                  <td className={`py-2 pr-4 text-right font-medium ${amountClass(row.total)}`}>
                    {formatAmount(row.total)}
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30 font-medium">
                <td className="py-2 pl-4" colSpan={3}>
                  Totales ({rows.length} comprobante{rows.length !== 1 ? 's' : ''})
                </td>
                <td className="text-right">{formatAmount(sumBy(rows, 'subtotal'))}</td>
                <td className="text-right">{formatAmount(sumBy(rows, 'vatAmount'))}</td>
                <td className="text-right">{formatAmount(sumBy(rows, 'otherTaxes'))}</td>
                <td className="py-2 pr-4 text-right">{formatAmount(sumBy(rows, 'total'))}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function _MonthlyVATInvoicesDetail({
  salesInvoices,
  purchaseInvoices,
  periodLabel,
  filePeriod,
}: MonthlyVATInvoicesDetailProps) {
  const handleExport = async (kind: BookKind) => {
    const rows = kind === 'sales' ? salesInvoices : purchaseInvoices;
    const bookName = kind === 'sales' ? 'IVA Ventas' : 'IVA Compras';

    const flatData = rows.map((row) => ({
      issueDate: moment(row.issueDate).format('DD/MM/YYYY'),
      voucherType: VOUCHER_SHORT_LABELS[row.voucherType],
      fullNumber: row.fullNumber,
      counterpartyName: row.counterpartyName,
      counterpartyTaxId: row.counterpartyTaxId ?? '',
      subtotal: row.subtotal,
      vatAmount: row.vatAmount,
      otherTaxes: row.otherTaxes,
      total: row.total,
    }));

    const amount = (v: unknown) => Number(Number(v).toFixed(2));
    const columns: ExcelColumn[] = [
      { key: 'issueDate', title: 'Fecha', width: 12 },
      { key: 'voucherType', title: 'Tipo', width: 10 },
      { key: 'fullNumber', title: 'Número', width: 18 },
      { key: 'counterpartyName', title: kind === 'sales' ? 'Cliente' : 'Proveedor', width: 35 },
      { key: 'counterpartyTaxId', title: 'CUIT', width: 15 },
      { key: 'subtotal', title: 'Neto', width: 15, formatter: amount },
      { key: 'vatAmount', title: 'IVA', width: 15, formatter: amount },
      { key: 'otherTaxes', title: 'Otros Imp.', width: 15, formatter: amount },
      { key: 'total', title: 'Total', width: 15, formatter: amount },
    ];

    await exportToExcel(flatData, columns, {
      filename: `libro-${kind === 'sales' ? 'iva-ventas' : 'iva-compras'}-${filePeriod}`,
      sheetName: bookName,
      title: `Libro ${bookName} - ${periodLabel}`,
      includeDate: true,
    });
  };

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">Detalle de Comprobantes</h3>
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Ventas ({salesInvoices.length})</TabsTrigger>
          <TabsTrigger value="purchases">Compras ({purchaseInvoices.length})</TabsTrigger>
        </TabsList>
        {(['sales', 'purchases'] as const).map((kind) => {
          const rows = kind === 'sales' ? salesInvoices : purchaseInvoices;
          return (
            <TabsContent key={kind} value={kind} className="space-y-2">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(kind)}
                  disabled={rows.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar {kind === 'sales' ? 'IVA Ventas' : 'IVA Compras'}
                </Button>
              </div>
              <InvoicesTable rows={rows} kind={kind} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
