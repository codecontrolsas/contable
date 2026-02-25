'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Download } from 'lucide-react';
import moment from 'moment';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { logger } from '@/shared/lib/logger';
import { exportToExcel, type ExcelColumn } from '@/shared/lib/excel-export';

import { getBudgetVarianceReport } from '../actions.server';
import { getAvailableFiscalYears } from '../../budgets/actions.server';
import { formatAmount } from '../../../shared/utils';
import { _BudgetVarianceSummary } from './_BudgetVarianceSummary';
import { _BudgetVarianceTable } from './_BudgetVarianceTable';

interface BudgetVarianceReportProps {
  companyId: string;
}

type ReportData = Awaited<ReturnType<typeof getBudgetVarianceReport>>;

export function _BudgetVarianceReport({ companyId }: BudgetVarianceReportProps) {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  const { data: fiscalYears, isLoading: isLoadingYears } = useQuery({
    queryKey: ['available-fiscal-years-report'],
    queryFn: () => getAvailableFiscalYears(),
  });

  // Set default year when fiscal years load
  useEffect(() => {
    if (fiscalYears && fiscalYears.length > 0 && !selectedYear) {
      setSelectedYear(String(fiscalYears[0]));
    }
  }, [fiscalYears, selectedYear]);

  const handleGenerate = async () => {
    if (!selectedYear) return;
    setIsLoading(true);
    try {
      const result = await getBudgetVarianceReport(
        companyId,
        Number(selectedYear)
      );
      setData(result);
    } catch (error) {
      logger.error('Error al generar reporte de variación presupuestaria', {
        data: { error },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!data) return;

    const flatData: Record<string, string | number>[] = [];

    // Ingresos
    flatData.push({ code: '', name: 'INGRESOS', budgeted: '', executed: '', variance: '', variancePercent: '' } as unknown as Record<string, string | number>);
    for (const account of data.revenue.accounts) {
      flatData.push({
        code: account.code,
        name: account.name,
        budgeted: account.budgeted,
        executed: account.executed,
        variance: account.variance,
        variancePercent: Number(account.variancePercent.toFixed(1)),
      });
    }
    flatData.push({
      code: '',
      name: 'Total Ingresos',
      budgeted: data.revenue.totalBudgeted,
      executed: data.revenue.totalExecuted,
      variance: data.revenue.totalVariance,
      variancePercent: Number(data.revenue.totalVariancePercent.toFixed(1)),
    });
    flatData.push({ code: '', name: '', budgeted: '', executed: '', variance: '', variancePercent: '' } as unknown as Record<string, string | number>);

    // Gastos
    flatData.push({ code: '', name: 'GASTOS', budgeted: '', executed: '', variance: '', variancePercent: '' } as unknown as Record<string, string | number>);
    for (const account of data.expenses.accounts) {
      flatData.push({
        code: account.code,
        name: account.name,
        budgeted: account.budgeted,
        executed: account.executed,
        variance: account.variance,
        variancePercent: Number(account.variancePercent.toFixed(1)),
      });
    }
    flatData.push({
      code: '',
      name: 'Total Gastos',
      budgeted: data.expenses.totalBudgeted,
      executed: data.expenses.totalExecuted,
      variance: data.expenses.totalVariance,
      variancePercent: Number(data.expenses.totalVariancePercent.toFixed(1)),
    });
    flatData.push({ code: '', name: '', budgeted: '', executed: '', variance: '', variancePercent: '' } as unknown as Record<string, string | number>);

    // Resultado neto
    flatData.push({
      code: '',
      name: 'Resultado Neto',
      budgeted: data.netBudgeted,
      executed: data.netExecuted,
      variance: data.netVariance,
      variancePercent: Number(data.netVariancePercent.toFixed(1)),
    });

    const columns: ExcelColumn[] = [
      { key: 'code', title: 'Código', width: 12 },
      { key: 'name', title: 'Cuenta', width: 40 },
      { key: 'budgeted', title: 'Presupuestado', width: 18, formatter: (v) => v === '' ? '' : Number(v).toFixed(2) },
      { key: 'executed', title: 'Ejecutado', width: 18, formatter: (v) => v === '' ? '' : Number(v).toFixed(2) },
      { key: 'variance', title: 'Desvío ($)', width: 18, formatter: (v) => v === '' ? '' : Number(v).toFixed(2) },
      { key: 'variancePercent', title: 'Desvío (%)', width: 12, formatter: (v) => v === '' ? '' : `${v}%` },
    ];

    await exportToExcel(flatData, columns, {
      filename: `variacion-presupuestaria-${data.fiscalYear}-${moment().format('YYYY-MM-DD')}`,
      sheetName: 'Variación Presupuestaria',
      title: `Variación Presupuestaria - Ejercicio ${data.fiscalYear}`,
      includeDate: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variación Presupuestaria</CardTitle>
        <CardDescription>
          Comparación entre presupuesto y ejecución real por cuenta contable
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Año Fiscal</label>
            {isLoadingYears ? (
              <div className="h-9 w-[120px] animate-pulse rounded-md bg-muted" />
            ) : (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {(fiscalYears ?? []).map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !selectedYear}
          >
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
        </div>

        {data && (
          <div className="space-y-6">
            <_BudgetVarianceSummary data={data} />

            <_BudgetVarianceTable
              title="Ingresos"
              section={data.revenue}
              type="revenue"
            />

            <_BudgetVarianceTable
              title="Gastos"
              section={data.expenses}
              type="expense"
            />

            {/* Resultado Neto */}
            <div className="rounded-md border bg-muted/20">
              <table className="w-full">
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 pl-4 font-semibold">
                      Ingresos Presupuestados
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-green-600">
                      {formatAmount(data.revenue.totalBudgeted)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 pl-4 font-semibold">
                      Gastos Presupuestados
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-red-600">
                      - {formatAmount(data.expenses.totalBudgeted)}
                    </td>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td className="py-3 pl-4 font-bold">
                      Resultado Neto Presupuestado
                    </td>
                    <td className="py-3 pr-4 text-right font-bold">
                      <span
                        className={
                          data.netBudgeted < 0
                            ? 'text-destructive'
                            : 'text-green-600'
                        }
                      >
                        {formatAmount(data.netBudgeted)}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td className="py-3 pl-4 font-bold">
                      Resultado Neto Real
                    </td>
                    <td className="py-3 pr-4 text-right font-bold">
                      <span
                        className={
                          data.netExecuted < 0
                            ? 'text-destructive'
                            : 'text-green-600'
                        }
                      >
                        {formatAmount(data.netExecuted)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pl-4 text-lg font-bold">
                      Variación del Resultado
                    </td>
                    <td className="py-3 pr-4 text-right text-lg font-bold">
                      <span
                        className={
                          data.netVariance >= 0
                            ? 'text-green-600'
                            : 'text-destructive'
                        }
                      >
                        {formatAmount(data.netVariance)}{' '}
                        <span className="text-sm font-normal">
                          ({data.netVariancePercent.toFixed(1)}%)
                        </span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
