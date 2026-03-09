'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { getMonthlyVATReport } from '../actions.server';
import { formatAmount } from '../../../shared/utils';
import { useState } from 'react';
import { Loader2, Download, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import moment from 'moment';
import { exportToExcel, type ExcelColumn } from '@/shared/lib/excel-export';
import { logger } from '@/shared/lib/logger';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface MonthlyVATReportProps {
  companyId: string;
}

export function _MonthlyVATReport({ companyId }: MonthlyVATReportProps) {
  const currentMonth = moment().month();
  const currentYear = moment().year();

  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMonthlyVATReport>> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await getMonthlyVATReport(companyId, year, month);
      setData(result);
      toast.success('Reporte generado correctamente');
    } catch (error) {
      logger.error('Error al generar reporte de IVA mensual', { data: { error } });
      toast.error(error instanceof Error ? error.message : 'Error al generar el reporte');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!data) return;

    const flatData = data.vatByRate.map((row) => ({
      rate: `${row.rate}%`,
      salesBase: row.salesBase,
      salesVAT: row.salesVAT,
      purchasesBase: row.purchasesBase,
      purchasesVAT: row.purchasesVAT,
      balance: row.balance,
    }));

    flatData.push({
      rate: 'TOTALES',
      salesBase: data.salesSummary.subtotal,
      salesVAT: data.totalSalesVAT,
      purchasesBase: data.purchasesSummary.subtotal,
      purchasesVAT: data.totalPurchasesVAT,
      balance: data.vatBalance,
    });

    const columns: ExcelColumn[] = [
      { key: 'rate', title: 'Alicuota', width: 12 },
      { key: 'salesBase', title: 'Base Imponible Ventas', width: 20, formatter: (v) => Number(v).toFixed(2) },
      { key: 'salesVAT', title: 'IVA Debito Fiscal', width: 18, formatter: (v) => Number(v).toFixed(2) },
      { key: 'purchasesBase', title: 'Base Imponible Compras', width: 22, formatter: (v) => Number(v).toFixed(2) },
      { key: 'purchasesVAT', title: 'IVA Credito Fiscal', width: 18, formatter: (v) => Number(v).toFixed(2) },
      { key: 'balance', title: 'Saldo IVA', width: 15, formatter: (v) => Number(v).toFixed(2) },
    ];

    await exportToExcel(flatData, columns, {
      filename: `iva-mensual-${year}-${String(month + 1).padStart(2, '0')}`,
      sheetName: 'IVA Mensual',
      title: `Posicion IVA - ${MONTH_NAMES[month]} ${year}`,
      includeDate: true,
    });
  };

  // Generar opciones de años (5 hacia atras)
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Posicion Mensual de IVA</CardTitle>
        <CardDescription>
          Calcula el IVA Debito Fiscal (Ventas) menos el IVA Credito Fiscal (Compras)
          para estimar la posicion de IVA del periodo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Mes</label>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Ano</label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={isLoading || !data}
            title="Exportar a Excel"
          >
            <Download className="h-4 w-4" />
          </Button>
        </form>

        {data && (
          <div className="space-y-6">
            {/* Resumen de posicion */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-muted-foreground">IVA Debito Fiscal (Ventas)</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{formatAmount(data.totalSalesVAT)}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.salesSummary.invoiceCount} factura{data.salesSummary.invoiceCount !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                    <p className="text-sm text-muted-foreground">IVA Credito Fiscal (Compras)</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{formatAmount(data.totalPurchasesVAT)}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.purchasesSummary.invoiceCount} factura{data.purchasesSummary.invoiceCount !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              <Card className={data.vatBalance > 0 ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950' : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    <p className="text-sm text-muted-foreground">
                      {data.vatBalance > 0 ? 'IVA a Pagar' : data.vatBalance < 0 ? 'IVA a Favor' : 'Posicion Neutra'}
                    </p>
                  </div>
                  <p className={`mt-2 text-2xl font-bold ${data.vatBalance > 0 ? 'text-red-600 dark:text-red-400' : data.vatBalance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                    {formatAmount(Math.abs(data.vatBalance))}
                  </p>
                  <Badge variant={data.vatBalance > 0 ? 'destructive' : data.vatBalance < 0 ? 'default' : 'secondary'} className="mt-1">
                    {data.vatBalance > 0 ? 'Saldo Deudor' : data.vatBalance < 0 ? 'Saldo a Favor' : 'Neutro'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Detalle por alicuota */}
            <div>
              <h3 className="mb-3 text-lg font-semibold">Detalle por Alicuota de IVA</h3>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-3 pl-4 text-left">Alicuota</th>
                      <th className="py-3 text-right">Base Ventas</th>
                      <th className="py-3 text-right">Debito Fiscal</th>
                      <th className="py-3 text-right">Base Compras</th>
                      <th className="py-3 text-right">Credito Fiscal</th>
                      <th className="py-3 pr-4 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vatByRate.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No hay movimientos de IVA en el periodo seleccionado
                        </td>
                      </tr>
                    ) : (
                      <>
                        {data.vatByRate.map((row) => (
                          <tr key={row.rate} className="border-b">
                            <td className="py-2 pl-4 font-medium">{row.rate}%</td>
                            <td className="text-right">{formatAmount(row.salesBase)}</td>
                            <td className="text-right">{formatAmount(row.salesVAT)}</td>
                            <td className="text-right">{formatAmount(row.purchasesBase)}</td>
                            <td className="text-right">{formatAmount(row.purchasesVAT)}</td>
                            <td className={`py-2 pr-4 text-right font-medium ${row.balance > 0 ? 'text-red-600 dark:text-red-400' : row.balance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                              {formatAmount(row.balance)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-muted/30 font-medium">
                          <td className="py-2 pl-4">Totales</td>
                          <td className="text-right">{formatAmount(data.salesSummary.subtotal)}</td>
                          <td className="text-right">{formatAmount(data.totalSalesVAT)}</td>
                          <td className="text-right">{formatAmount(data.purchasesSummary.subtotal)}</td>
                          <td className="text-right">{formatAmount(data.totalPurchasesVAT)}</td>
                          <td className={`py-2 pr-4 text-right ${data.vatBalance > 0 ? 'text-red-600 dark:text-red-400' : data.vatBalance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                            {formatAmount(data.vatBalance)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen de operaciones */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ventas del Periodo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Neto Gravado:</span>
                      <span>{formatAmount(data.salesSummary.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA:</span>
                      <span>{formatAmount(data.salesSummary.vatAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <span>{formatAmount(data.salesSummary.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Compras del Periodo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Neto Gravado:</span>
                      <span>{formatAmount(data.purchasesSummary.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA:</span>
                      <span>{formatAmount(data.purchasesSummary.vatAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <span>{formatAmount(data.purchasesSummary.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
