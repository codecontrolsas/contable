'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import moment from 'moment';
import { FileEdit, Lock, History } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
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

import { BudgetStatus } from '@/generated/prisma/enums';
import { getBudgetDetail, closeBudget } from '../actions.server';
import { formatAmount } from '../../../shared/utils';
import { _BudgetRevisionModal } from './_BudgetRevisionModal';
import { _BudgetMonthlyTable } from './_BudgetMonthlyTable';
import { _BudgetRevisionHistory } from './_BudgetRevisionHistory';

interface BudgetDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string | null;
  onBudgetChanged: () => void;
}

const STATUS_LABELS: Record<BudgetStatus, string> = {
  [BudgetStatus.DRAFT]: 'Borrador',
  [BudgetStatus.ACTIVE]: 'Activo',
  [BudgetStatus.CLOSED]: 'Cerrado',
};

const STATUS_VARIANT: Record<
  BudgetStatus,
  'secondary' | 'default' | 'outline'
> = {
  [BudgetStatus.DRAFT]: 'secondary',
  [BudgetStatus.ACTIVE]: 'default',
  [BudgetStatus.CLOSED]: 'outline',
};

export function _BudgetDetailModal({
  open,
  onOpenChange,
  budgetId,
  onBudgetChanged,
}: BudgetDetailModalProps) {
  const queryClient = useQueryClient();
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['budget-detail', budgetId],
    queryFn: () => getBudgetDetail(budgetId!),
    enabled: open && !!budgetId,
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeBudget(id),
    onSuccess: () => {
      toast.success('Presupuesto cerrado correctamente');
      queryClient.invalidateQueries({ queryKey: ['budget-detail', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onBudgetChanged();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al cerrar el presupuesto');
    },
  });

  const handleClose = () => {
    setCloseConfirmOpen(false);
    if (budgetId) {
      closeMutation.mutate(budgetId);
    }
  };

  const handleRevisionCreated = () => {
    setRevisionModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['budget-detail', budgetId] });
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    onBudgetChanged();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del Presupuesto</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <_DetailSkeleton />
          ) : !detail ? (
            <div className="py-8 text-center text-muted-foreground">
              No se encontro el presupuesto.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header info */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">
                    {detail.account.code} - {detail.account.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ejercicio Fiscal {detail.fiscalYear} &middot; Total
                    presupuestado: {formatAmount(detail.totalAmount)}
                  </p>
                </div>
                <Badge
                  variant={STATUS_VARIANT[detail.status]}
                  className="w-fit"
                >
                  {STATUS_LABELS[detail.status]}
                </Badge>
              </div>

              <Separator />

              {/* Monthly comparison table */}
              <_BudgetMonthlyTable
                monthLabels={detail.monthLabels}
                monthlyAmounts={detail.monthlyAmounts}
                monthlyExecuted={detail.monthlyExecuted}
                monthlyVariance={detail.monthlyVariance}
                monthlyVariancePercent={detail.monthlyVariancePercent}
                totalAmount={detail.totalAmount}
                totalExecuted={detail.totalExecuted}
                totalVariance={detail.totalVariance}
                totalVariancePercent={detail.totalVariancePercent}
                accountType={detail.account.type}
              />

              {/* Revision history */}
              {detail.revisions.length > 0 && (
                <>
                  <Separator />
                  <_BudgetRevisionHistory
                    revisions={detail.revisions}
                    monthLabels={detail.monthLabels}
                  />
                </>
              )}

              {/* Actions */}
              {detail.status === BudgetStatus.ACTIVE && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setRevisionModalOpen(true)}
                    >
                      <FileEdit className="mr-2 h-4 w-4" />
                      Revisar Presupuesto
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCloseConfirmOpen(true)}
                      disabled={closeMutation.isPending}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Cerrar Presupuesto
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close confirmation */}
      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar presupuesto</AlertDialogTitle>
            <AlertDialogDescription>
              El presupuesto se cerrara y no podra modificarse. Esta accion no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? 'Cerrando...' : 'Cerrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revision modal */}
      {detail && budgetId && (
        <_BudgetRevisionModal
          open={revisionModalOpen}
          onOpenChange={setRevisionModalOpen}
          budgetId={budgetId}
          currentAmounts={detail.monthlyAmounts}
          monthLabels={detail.monthLabels}
          onRevisionCreated={handleRevisionCreated}
        />
      )}
    </>
  );
}

function _DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}
