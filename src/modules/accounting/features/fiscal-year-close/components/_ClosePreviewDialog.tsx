'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import moment from 'moment';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { previewFiscalYearClose, closeFiscalYear } from '../actions.server';
import { formatAmount } from '../../../shared/utils';

interface ClosePreviewDialogProps {
  companyId: string;
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
  onClose: () => void;
}

type PreviewData = Awaited<ReturnType<typeof previewFiscalYearClose>>;

export function _ClosePreviewDialog({
  companyId,
  fiscalYearStart,
  fiscalYearEnd,
  onClose,
}: ClosePreviewDialogProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canApprove = hasPermission('accounting.fiscal-year-close', 'approve');
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const data = await previewFiscalYearClose(companyId);
        setPreview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al generar preview');
      } finally {
        setIsLoadingPreview(false);
      }
    };
    loadPreview();
  }, [companyId]);

  const handleClose = async () => {
    setIsClosing(true);
    try {
      const result = await closeFiscalYear(companyId);
      toast.success(
        `Ejercicio fiscal cerrado. Nuevo ejercicio N° ${result.newFiscalYear} creado.`
      );
      router.refresh();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Error al cerrar el ejercicio fiscal');
      }
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Cierre de Ejercicio Fiscal</AlertDialogTitle>
          <AlertDialogDescription>
            Período: {moment(fiscalYearStart).format('DD/MM/YYYY')} - {moment(fiscalYearEnd).format('DD/MM/YYYY')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoadingPreview ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Calculando saldos...</span>
          </div>
        ) : error ? (
          <div className="py-4 text-center text-destructive text-sm">{error}</div>
        ) : preview ? (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Ingresos</p>
                <p className="text-sm font-mono font-medium text-green-600">
                  {formatAmount(preview.totalRevenue)}
                </p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Gastos</p>
                <p className="text-sm font-mono font-medium text-red-600">
                  {formatAmount(preview.totalExpense)}
                </p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Resultado Neto</p>
                <Badge variant={preview.netResult >= 0 ? 'default' : 'destructive'}>
                  {formatAmount(preview.netResult)}
                </Badge>
              </div>
            </div>

            {/* Tabla de líneas */}
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-2 pl-3 text-left">Cuenta</th>
                    <th className="py-2 text-right">Debe</th>
                    <th className="py-2 pr-3 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-1.5 pl-3">
                        <span className="font-mono text-xs">{line.accountCode}</span>{' '}
                        {line.accountName}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {line.debit > 0 ? formatAmount(line.debit) : ''}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">
                        {line.credit > 0 ? formatAmount(line.credit) : ''}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-medium">
                    <td className="py-2 pl-3">Total</td>
                    <td className="py-2 text-right font-mono">
                      {formatAmount(preview.lines.reduce((s, l) => s + l.debit, 0))}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {formatAmount(preview.lines.reduce((s, l) => s + l.credit, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Preview asiento de apertura */}
            {preview.openingLines.length > 0 && (
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-muted/50">
                  Asiento de apertura ({preview.openingLines.length} líneas)
                </summary>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-2 pl-3 text-left">Cuenta</th>
                      <th className="py-2 text-right">Debe</th>
                      <th className="py-2 pr-3 text-right">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.openingLines.map((line, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-1.5 pl-3">
                          <span className="font-mono text-xs">{line.accountCode}</span>{' '}
                          {line.accountName}
                        </td>
                        <td className="py-1.5 text-right font-mono">
                          {line.debit > 0 ? formatAmount(line.debit) : ''}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {line.credit > 0 ? formatAmount(line.credit) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            <p className="text-xs text-muted-foreground">
              Al confirmar se generará: (1) asiento de refundición de resultados, (2) nuevo ejercicio fiscal
              con sus períodos, (3) asiento de apertura en el nuevo ejercicio.
              Una vez cerrado, no se puede revertir automáticamente.
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClosing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClose}
            disabled={isClosing || isLoadingPreview || !!error || !preview || !canApprove}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isClosing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Cierre
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
