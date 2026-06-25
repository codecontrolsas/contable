'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { getBalanceSheet } from '../actions.server';
import { formatAmount } from '../../../shared/utils';
import { useState } from 'react';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import moment from 'moment';
import { exportToExcel, ExcelColumn } from '@/shared/lib/excel-export';
import { logger } from '@/shared/lib/logger';

interface BalanceSheetReportProps {
  companyId: string;
}

export function _BalanceSheetReport({ companyId }: BalanceSheetReportProps) {
  const [asOfDate, setAsOfDate] = useState<string>(
    moment().format('YYYY-MM-DD')
  );
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getBalanceSheet>> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await getBalanceSheet(
        companyId,
        new Date(asOfDate)
      );
      setData(result);
    } catch (error) {
      logger.error('Error al obtener balance general', { data: { error } });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!data) return;

    const flatData: any[] = [];

    // Activos
    flatData.push({
      code: '',
      name: 'ACTIVO',
      balance: '',
    });
    data.assets.accounts.forEach((account) => {
      flatData.push({
        code: account.code,
        name: account.name,
        balance: account.balance,
      });
    });
    flatData.push({
      code: '',
      name: 'Total Activo',
      balance: data.assets.total,
    });
    flatData.push({ code: '', name: '', balance: '' });

    // Pasivos
    flatData.push({
      code: '',
      name: 'PASIVO',
      balance: '',
    });
    data.liabilities.accounts.forEach((account) => {
      flatData.push({
        code: account.code,
        name: account.name,
        balance: account.balance,
      });
    });
    flatData.push({
      code: '',
      name: 'Total Pasivo',
      balance: data.liabilities.total,
    });
    flatData.push({ code: '', name: '', balance: '' });

    // Patrimonio
    flatData.push({
      code: '',
      name: 'PATRIMONIO NETO',
      balance: '',
    });
    data.equity.accounts.forEach((account) => {
      flatData.push({
        code: account.code,
        name: account.name,
        balance: account.balance,
      });
    });
    if (data.periodResult !== 0) {
      flatData.push({
        code: '',
        name: 'Resultado del ejercicio en curso',
        balance: data.periodResult,
      });
    }
    flatData.push({
      code: '',
      name: 'Total Patrimonio Neto',
      balance: data.equity.total + data.periodResult,
    });

    const columns: ExcelColumn[] = [
      { key: 'code', title: 'Código', width: 12 },
      { key: 'name', title: 'Cuenta', width: 40 },
      {
        key: 'balance',
        title: 'Saldo',
        width: 18,
        formatter: (value) => value === '' ? '' : (value as number).toFixed(2),
      },
    ];

    await exportToExcel(flatData, columns, {
      filename: `balance-general-${moment(asOfDate).format('YYYY-MM-DD')}`,
      sheetName: 'Balance General',
      title: 'Balance General',
      includeDate: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance General</CardTitle>
        <CardDescription>
          Estado de situación patrimonial: Activo = Pasivo + Patrimonio Neto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="asOfDate">A la fecha</Label>
            <Input
              id="asOfDate"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              disabled={isLoading}
            />
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

        {data && !data.isBalanced && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>
              El balance no está equilibrado. Diferencia: {formatAmount(data.difference)}
            </span>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Activo */}
            <div className="rounded-md border">
              <div className="border-b bg-muted px-4 py-3">
                <h3 className="text-lg font-semibold">{data.assets.title}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-3 pl-4 text-left">Código</th>
                    <th className="py-3 text-left">Cuenta</th>
                    <th className="py-3 pr-4 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assets.accounts.map((account) => (
                    <tr key={account.code} className="border-b">
                      <td className="py-2 pl-4">{account.code}</td>
                      <td>{account.name}</td>
                      <td className="py-2 pr-4 text-right">
                        {formatAmount(account.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="py-3 pl-4" colSpan={2}>
                      Total Activo
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatAmount(data.totalAssets)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pasivo */}
            <div className="rounded-md border">
              <div className="border-b bg-muted px-4 py-3">
                <h3 className="text-lg font-semibold">{data.liabilities.title}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-3 pl-4 text-left">Código</th>
                    <th className="py-3 text-left">Cuenta</th>
                    <th className="py-3 pr-4 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.liabilities.accounts.map((account) => (
                    <tr key={account.code} className="border-b">
                      <td className="py-2 pl-4">{account.code}</td>
                      <td>{account.name}</td>
                      <td className="py-2 pr-4 text-right">
                        {formatAmount(account.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="py-3 pl-4" colSpan={2}>
                      Total Pasivo
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatAmount(data.liabilities.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Patrimonio Neto */}
            <div className="rounded-md border">
              <div className="border-b bg-muted px-4 py-3">
                <h3 className="text-lg font-semibold">{data.equity.title}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-3 pl-4 text-left">Código</th>
                    <th className="py-3 text-left">Cuenta</th>
                    <th className="py-3 pr-4 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.equity.accounts.map((account) => (
                    <tr key={account.code} className="border-b">
                      <td className="py-2 pl-4">{account.code}</td>
                      <td>{account.name}</td>
                      <td className="py-2 pr-4 text-right">
                        {formatAmount(account.balance)}
                      </td>
                    </tr>
                  ))}
                  {data.periodResult !== 0 && (
                    <tr className="border-b bg-blue-50 dark:bg-blue-950/30">
                      <td className="py-2 pl-4 italic" colSpan={2}>
                        Resultado del ejercicio en curso
                      </td>
                      <td className="py-2 pr-4 text-right italic">
                        {formatAmount(data.periodResult)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="py-3 pl-4" colSpan={2}>
                      Total Patrimonio Neto
                      {data.periodResult !== 0 ? ' (inc. resultado del ejercicio)' : ''}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatAmount(data.equity.total + data.periodResult)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Resumen */}
            <div className="rounded-md border bg-muted/20">
              <table className="w-full">
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 pl-4 font-semibold">Total Activo</td>
                    <td className="py-3 pr-4 text-right font-semibold">
                      {formatAmount(data.totalAssets)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 pl-4 font-semibold">Total Pasivo + Patrimonio Neto</td>
                    <td className="py-3 pr-4 text-right font-semibold">
                      {formatAmount(data.totalLiabilitiesAndEquity)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pl-4 font-bold">Diferencia</td>
                    <td className="py-3 pr-4 text-right font-bold">
                      <span
                        className={
                          Math.abs(data.difference) >= 0.01
                            ? 'text-destructive'
                            : 'text-green-600'
                        }
                      >
                        {formatAmount(data.difference)}
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
