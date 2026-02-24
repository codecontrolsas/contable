'use client';

import { useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import moment from 'moment';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { exportToExcel, type ExcelColumn } from '@/shared/lib/excel-export';
import { logger } from '@/shared/lib/logger';

import { getFixedAssetsRegister } from '../actions.server';
import { formatAmount } from '../../../shared/utils';

const methodLabels: Record<string, string> = {
  STRAIGHT_LINE: 'Línea Recta',
  DECLINING_BALANCE: 'Saldo Decreciente',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activa',
  COMPLETED: 'Completada',
  SUSPENDED: 'Suspendida',
};

interface Props {
  companyId: string;
}

export function _FixedAssetsReport({ companyId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getFixedAssetsRegister>> | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const result = await getFixedAssetsRegister(companyId);
      setData(result);
    } catch (error) {
      logger.error('Error al generar reporte de bienes de uso', { data: { error } });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const flatData = data.items.map((item) => ({
      internNumber: item.internNumber || '-',
      domain: item.domain || '-',
      typeName: item.typeName || '-',
      brandModel: [item.brandName, item.modelName].filter(Boolean).join(' ') || '-',
      method: methodLabels[item.method] || item.method,
      status: statusLabels[item.status] || item.status,
      grossValue: item.grossValue,
      totalDepreciated: item.totalDepreciated,
      currentBookValue: item.currentBookValue,
      usefulLifeMonths: item.usefulLifeMonths,
      percentDepreciated: `${item.percentDepreciated}%`,
    }));

    flatData.push({
      internNumber: '',
      domain: 'TOTALES',
      typeName: '',
      brandModel: '',
      method: '',
      status: '',
      grossValue: data.totals.grossValue,
      totalDepreciated: data.totals.totalDepreciated,
      currentBookValue: data.totals.currentBookValue,
      usefulLifeMonths: 0,
      percentDepreciated: '',
    });

    const columns: ExcelColumn[] = [
      { key: 'internNumber', title: 'N° Interno', width: 12 },
      { key: 'domain', title: 'Dominio', width: 12 },
      { key: 'typeName', title: 'Tipo', width: 15 },
      { key: 'brandModel', title: 'Marca / Modelo', width: 20 },
      { key: 'method', title: 'Método', width: 15 },
      { key: 'status', title: 'Estado', width: 12 },
      { key: 'grossValue', title: 'Valor Bruto', width: 15, format: '$#,##0.00' },
      { key: 'totalDepreciated', title: 'Dep. Acumulada', width: 15, format: '$#,##0.00' },
      { key: 'currentBookValue', title: 'Valor Libro', width: 15, format: '$#,##0.00' },
      { key: 'usefulLifeMonths', title: 'Vida Útil (m)', width: 12 },
      { key: 'percentDepreciated', title: '% Deprec.', width: 10 },
    ];

    exportToExcel(flatData, columns, {
      filename: 'registro-bienes-de-uso',
      title: 'Registro de Bienes de Uso',
      sheetName: 'Bienes de Uso',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Registro de Bienes de Uso</CardTitle>
            <CardDescription>
              Listado de todos los equipos con depreciación configurada
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {data && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            )}
            <Button onClick={handleGenerate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Presione &quot;Generar&quot; para ver el reporte
          </p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay equipos con depreciación configurada
          </p>
        ) : (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Valor Bruto Total</p>
                <p className="text-lg font-semibold">{formatAmount(data.totals.grossValue)}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Dep. Acumulada Total</p>
                <p className="text-lg font-semibold">{formatAmount(data.totals.totalDepreciated)}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Valor Libro Total</p>
                <p className="text-lg font-semibold">{formatAmount(data.totals.currentBookValue)}</p>
              </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Equipo</th>
                    <th className="text-left p-2 hidden sm:table-cell">Tipo</th>
                    <th className="text-left p-2 hidden md:table-cell">Método</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-right p-2">Valor Bruto</th>
                    <th className="text-right p-2">Dep. Acum.</th>
                    <th className="text-right p-2">Valor Libro</th>
                    <th className="text-right p-2 hidden sm:table-cell">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.vehicleId} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div>
                          <span className="font-medium">{item.internNumber || item.domain || '-'}</span>
                          {item.brandName && (
                            <span className="text-xs text-muted-foreground ml-1">
                              {item.brandName} {item.modelName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 hidden sm:table-cell">{item.typeName || '-'}</td>
                      <td className="p-2 hidden md:table-cell">{methodLabels[item.method]}</td>
                      <td className="p-2">
                        <Badge
                          variant={
                            item.status === 'ACTIVE'
                              ? 'default'
                              : item.status === 'COMPLETED'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="text-xs"
                        >
                          {statusLabels[item.status]}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">{formatAmount(item.grossValue)}</td>
                      <td className="p-2 text-right">{formatAmount(item.totalDepreciated)}</td>
                      <td className="p-2 text-right font-medium">{formatAmount(item.currentBookValue)}</td>
                      <td className="p-2 text-right hidden sm:table-cell">{item.percentDepreciated}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="p-2" colSpan={4}>TOTALES ({data.count} equipos)</td>
                    <td className="p-2 text-right">{formatAmount(data.totals.grossValue)}</td>
                    <td className="p-2 text-right">{formatAmount(data.totals.totalDepreciated)}</td>
                    <td className="p-2 text-right">{formatAmount(data.totals.currentBookValue)}</td>
                    <td className="p-2 hidden sm:table-cell"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
