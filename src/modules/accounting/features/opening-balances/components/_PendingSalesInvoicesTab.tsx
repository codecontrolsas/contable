'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import moment from 'moment';
import { Loader2, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog';

import { usePermissions } from '@/shared/hooks/usePermissions';
import { getOpeningBalanceInvoices, deleteOpeningInvoice } from '../actions.server';
import { _CreateInvoiceDialog } from './_CreateInvoiceDialog';
import { _InvoiceImportDialog } from './_InvoiceImportDialog';
import { formatAmount } from '../../../shared/utils';

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  FACTURA_A: 'FC A',
  FACTURA_B: 'FC B',
  FACTURA_C: 'FC C',
  NOTA_CREDITO_A: 'NC A',
  NOTA_CREDITO_B: 'NC B',
  NOTA_CREDITO_C: 'NC C',
};

interface Props {
  contractors: Array<{ id: string; name: string; taxId: string | null }>;
  pointsOfSale: Array<{ id: string; number: number; name: string | null }>;
}

export function _PendingSalesInvoicesTab({ contractors, pointsOfSale }: Props) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['opening-balance-invoices'],
    queryFn: () => getOpeningBalanceInvoices(),
  });

  const invoices = data?.salesInvoices || [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['opening-balance-invoices'] });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOpeningInvoice('sales', id);
      toast.success('Factura eliminada');
      handleRefresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(msg);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>Facturas de Venta Pendientes de Cobro</span>
          {hasPermission('accounting.opening-balances', 'create') && (
            <div className="flex gap-2">
              <_InvoiceImportDialog type="sales" onImported={handleRefresh} />
              <_CreateInvoiceDialog
                type="sales"
                contractors={contractors}
                pointsOfSale={pointsOfSale}
                onCreated={handleRefresh}
              />
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Cargá las facturas de venta pendientes de cobro del sistema anterior.
          Aparecerán automáticamente en el Flujo de Caja como cuentas por cobrar.
        </p>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && invoices.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No hay facturas de apertura cargadas
          </p>
        )}

        {!isLoading && invoices.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">Comprobante</th>
                  <th className="pb-2 font-medium hidden sm:table-cell">
                    Fecha
                  </th>
                  <th className="pb-2 font-medium hidden sm:table-cell">
                    Vencimiento
                  </th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2">{inv.customer.name}</td>
                    <td className="py-2">
                      <span className="text-muted-foreground mr-1">
                        {VOUCHER_TYPE_LABELS[inv.voucherType] || inv.voucherType}
                      </span>
                      {inv.fullNumber}
                    </td>
                    <td className="py-2 hidden sm:table-cell">
                      {moment(inv.issueDate).format('DD/MM/YYYY')}
                    </td>
                    <td className="py-2 hidden sm:table-cell">
                      {inv.dueDate
                        ? moment(inv.dueDate).format('DD/MM/YYYY')
                        : '-'}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatAmount(inv.total)}
                    </td>
                    {hasPermission('accounting.opening-balances', 'delete') && (
                      <td className="py-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                ¿Eliminar factura?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará la factura {inv.fullNumber}. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(inv.id)}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={4} className="py-2">
                    Total ({invoices.length} factura
                    {invoices.length !== 1 ? 's' : ''})
                  </td>
                  <td className="py-2 text-right">
                    {formatAmount(
                      invoices.reduce((sum, inv) => sum + inv.total, 0)
                    )}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
