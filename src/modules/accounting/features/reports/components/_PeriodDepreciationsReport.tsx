'use client';

import { useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import moment from 'moment';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { exportToExcel, type ExcelColumn } from '@/shared/lib/excel-export';
import { logger } from '@/shared/lib/logger';

import { getPeriodDepreciations } from '../actions.server';
import { formatAmount } from '../../../shared/utils';

interface Props {
  companyId: string;
}

export function _PeriodDepreciationsReport({ companyId }: Props) {
  const [fromDate, setFromDate] = useState(moment().startOf('month').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(moment().format('YYYY-MM-DD'));
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getPeriodDepreciations>> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await getPeriodDepreciations(companyId, new Date(fromDate), new Date(toDate));
      setData(result);
    } catch (error) {
      logger.error('Error al generar reporte de depreciaciones', { data: { error } });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const flatData = data.items.map((item) => ({
      vehicleLabel: item.vehicleLabel,
      typeName: item.typeName || '-',
      periodNumber: item.periodNumber,
      scheduledDate: moment(item.scheduledDate).format('MM/YYYY'),
      amount: item.amount,
      accumulatedAmount: item.accumulatedAmount,
      entryNumber: item.entryNumber || '-',
      postedDate: item.postedDate ? moment(item.postedDate).format('DD/MM/YYYY') : '-',
    }));

    flatData.push({
      vehicleLabel: 'TOTALES',
      typeName: '',
      periodNumber: 0,
      scheduledDate: '',
      amount: data.totalAmount,
      accumulatedAmount: 0,
      entryNumber: '',
      postedDate: '',
    });

    const columns: ExcelColumn[] = [
      { key: 'vehicleLabel', title: 'Equipo', width: 15 },
      { key: 'typeName', title: 'Tipo', width: 15 },
      { key: 'periodNumber', title: 'Período', width: 10 },
      { key: 'scheduledDate', title: 'Mes', width: 10 },
      { key: 'amount', title: 'Monto', width: 15, format: '$#,##0.00' },
      { key: 'accumulatedAmount', title: 'Acumulado', width: 15, format: '$#,##0.00' },
      { key: 'entryNumber', title: 'Asiento N°', width: 12 },
      { key: 'postedDate', title: 'Fecha Contab.', width: 14 },
    ];

    exportToExcel(flatData, columns, {
      filename: `depreciaciones-${fromDate}-${toDate}`,
      title: `Depreciaciones del ${moment(fromDate).format('DD/MM/YYYY')} al ${moment(toDate).format('DD/MM/YYYY')}`,
      sheetName: 'Depreciaciones',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Depreciaciones del Período</CardTitle>
        <CardDescription>
          Detalle de depreciaciones contabilizadas en un rango de fechas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="deprFromDate">Desde</Label>
            <Input
              id="deprFromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deprToDate">Hasta</Label>
            <Input
              id="deprToDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generar
            </Button>
            {data && (
              <Button variant="outline" type="button" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            )}
          </div>
        </form>

        {data && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Total Contabilizado</p>
                <p className="text-lg font-semibold">{formatAmount(data.totalAmount)}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Períodos</p>
                <p className="text-lg font-semibold">{data.count}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Equipos</p>
                <p className="text-lg font-semibold">{data.vehicleCount}</p>
              </div>
            </div>

            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay depreciaciones contabilizadas en el período seleccionado
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Equipo</th>
                      <th className="text-left p-2 hidden sm:table-cell">Tipo</th>
                      <th className="text-center p-2">Período</th>
                      <th className="text-center p-2">Mes</th>
                      <th className="text-right p-2">Monto</th>
                      <th className="text-right p-2 hidden sm:table-cell">Acumulado</th>
                      <th className="text-center p-2 hidden md:table-cell">Asiento</th>
                      <th className="text-center p-2 hidden md:table-cell">Fecha Contab.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, idx) => (
                      <tr key={`${item.vehicleId}-${item.periodNumber}-${idx}`} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{item.vehicleLabel}</td>
                        <td className="p-2 hidden sm:table-cell">{item.typeName || '-'}</td>
                        <td className="p-2 text-center">{item.periodNumber}</td>
                        <td className="p-2 text-center">{moment(item.scheduledDate).format('MM/YYYY')}</td>
                        <td className="p-2 text-right">{formatAmount(item.amount)}</td>
                        <td className="p-2 text-right hidden sm:table-cell">{formatAmount(item.accumulatedAmount)}</td>
                        <td className="p-2 text-center hidden md:table-cell">
                          {item.entryNumber ? `#${item.entryNumber}` : '-'}
                        </td>
                        <td className="p-2 text-center hidden md:table-cell">
                          {item.postedDate ? moment(item.postedDate).format('DD/MM/YYYY') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="p-2" colSpan={4}>TOTAL</td>
                      <td className="p-2 text-right">{formatAmount(data.totalAmount)}</td>
                      <td className="p-2 hidden sm:table-cell"></td>
                      <td className="p-2 hidden md:table-cell"></td>
                      <td className="p-2 hidden md:table-cell"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
