'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { CalendarDays, Lock, LockOpen } from 'lucide-react';
import moment from 'moment';
import Link from 'next/link';
import { useState } from 'react';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { _ClosePreviewDialog } from './_ClosePreviewDialog';

interface FiscalYearStatusProps {
  companyId: string;
  status: {
    fiscalYearStart: Date;
    fiscalYearEnd: Date;
    resultAccountId: string | null;
    resultAccountName: string | null;
    isClosed: boolean;
    closingEntryId: string | null;
    closingEntryNumber: number | null;
  };
}

export function _FiscalYearStatus({ companyId, status }: FiscalYearStatusProps) {
  const { hasPermission } = usePermissions();
  const canApprove = hasPermission('accounting.fiscal-year-close', 'approve');
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const missingConfig = !status.resultAccountId;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Ejercicio Fiscal
              </CardTitle>
              <CardDescription>
                {moment(status.fiscalYearStart).format('DD/MM/YYYY')} - {moment(status.fiscalYearEnd).format('DD/MM/YYYY')}
              </CardDescription>
            </div>
            <Badge variant={status.isClosed ? 'default' : 'outline'} className="text-sm">
              {status.isClosed ? (
                <><Lock className="mr-1 h-3 w-3" /> Cerrado</>
              ) : (
                <><LockOpen className="mr-1 h-3 w-3" /> Abierto</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.isClosed ? (
            <div className="rounded-md border bg-muted/50 p-4">
              <p className="text-sm">
                El ejercicio fiscal fue cerrado con el asiento N° <strong>{status.closingEntryNumber}</strong>.
              </p>
              <Link
                href="/dashboard/company/accounting/entries"
                className="text-sm text-primary hover:underline mt-1 inline-block"
              >
                Ver asientos contables
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border p-4 space-y-2">
                <p className="text-sm font-medium">Cuenta de Resultado del Ejercicio</p>
                {status.resultAccountName ? (
                  <p className="text-sm text-muted-foreground">{status.resultAccountName}</p>
                ) : (
                  <p className="text-sm text-destructive">
                    No configurada.{' '}
                    <Link href="/dashboard/company/accounting/settings" className="underline">
                      Configurar en Settings
                    </Link>
                  </p>
                )}
              </div>

              {canApprove && (
                <Button
                  onClick={() => setShowCloseDialog(true)}
                  disabled={missingConfig}
                  className="w-full"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Cerrar Ejercicio Fiscal
                </Button>
              )}

              {canApprove && missingConfig && (
                <p className="text-xs text-muted-foreground text-center">
                  Debe configurar la cuenta de Resultado del Ejercicio antes de cerrar
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showCloseDialog && (
        <_ClosePreviewDialog
          companyId={companyId}
          fiscalYearStart={status.fiscalYearStart}
          fiscalYearEnd={status.fiscalYearEnd}
          onClose={() => setShowCloseDialog(false)}
        />
      )}
    </>
  );
}
