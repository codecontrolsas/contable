'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
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
import { Skeleton } from '@/shared/components/ui/skeleton';
import { usePermissions } from '@/shared/hooks/usePermissions';

import { BudgetStatus } from '@/generated/prisma/enums';
import {
  getBudgets,
  activateBudget,
  closeBudget,
  deleteBudget,
} from '../actions.server';
import { formatAmount } from '../../../shared/utils';

interface BudgetsTableProps {
  fiscalYear: number;
  onViewDetail: (budgetId: string) => void;
}

type BudgetItem = Awaited<ReturnType<typeof getBudgets>>[number];

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

const TYPE_LABELS: Record<string, string> = {
  EXPENSE: 'Gasto',
  REVENUE: 'Ingreso',
};

export function _BudgetsTable({ fiscalYear, onViewDetail }: BudgetsTableProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('accounting.budgets', 'create');
  const canApprove = hasPermission('accounting.budgets', 'approve');
  const canDelete = hasPermission('accounting.budgets', 'delete');

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'close' | 'delete';
    budget: BudgetItem;
  } | null>(null);

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', fiscalYear],
    queryFn: () => getBudgets(fiscalYear),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateBudget(id),
    onSuccess: () => {
      toast.success('Presupuesto activado correctamente');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al activar el presupuesto');
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeBudget(id),
    onSuccess: () => {
      toast.success('Presupuesto cerrado correctamente');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al cerrar el presupuesto');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      toast.success('Presupuesto eliminado correctamente');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el presupuesto');
    },
  });

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    const { type, budget } = confirmAction;

    switch (type) {
      case 'activate':
        activateMutation.mutate(budget.id);
        break;
      case 'close':
        closeMutation.mutate(budget.id);
        break;
      case 'delete':
        deleteMutation.mutate(budget.id);
        break;
    }

    setConfirmAction(null);
  };

  const getConfirmTitle = () => {
    if (!confirmAction) return '';
    const titles = {
      activate: 'Activar presupuesto',
      close: 'Cerrar presupuesto',
      delete: 'Eliminar presupuesto',
    };
    return titles[confirmAction.type];
  };

  const getConfirmDescription = () => {
    if (!confirmAction) return '';
    const account = confirmAction.budget.account;
    const accountLabel = `${account.code} - ${account.name}`;

    const descriptions = {
      activate: `El presupuesto de "${accountLabel}" pasara a estado Activo. Solo podra modificarse mediante revisiones formales.`,
      close: `El presupuesto de "${accountLabel}" se cerrara y no podra modificarse. Esta accion no se puede deshacer.`,
      delete: `Se eliminara permanentemente el presupuesto de "${accountLabel}" y todas sus revisiones. Esta accion no se puede deshacer.`,
    };
    return descriptions[confirmAction.type];
  };

  const isActionLoading =
    activateMutation.isPending ||
    closeMutation.isPending ||
    deleteMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!budgets || budgets.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No hay presupuestos para el ejercicio fiscal {fiscalYear}.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <table className="w-full" data-testid="budgets-table">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">
                Cuenta
              </th>
              <th className="hidden px-4 py-3 text-left text-sm font-medium sm:table-cell">
                Tipo
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">
                Monto Total
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Estado
              </th>
              <th className="hidden px-4 py-3 text-center text-sm font-medium sm:table-cell">
                Revisiones
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((budget) => (
              <tr key={budget.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {budget.account.code} - {budget.account.name}
                    </p>
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Badge
                    variant={
                      budget.account.type === 'EXPENSE'
                        ? 'destructive'
                        : 'default'
                    }
                    className="text-xs"
                  >
                    {TYPE_LABELS[budget.account.type] ?? budget.account.type}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {formatAmount(budget.totalAmount)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[budget.status]}>
                    {STATUS_LABELS[budget.status]}
                  </Badge>
                </td>
                <td className="hidden px-4 py-3 text-center text-sm sm:table-cell">
                  {budget.revisionsCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onViewDetail(budget.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalle
                      </DropdownMenuItem>

                      {canApprove && budget.status === BudgetStatus.DRAFT && (
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmAction({
                              type: 'activate',
                              budget,
                            })
                          }
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Activar
                        </DropdownMenuItem>
                      )}

                      {canApprove && budget.status === BudgetStatus.ACTIVE && (
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmAction({
                              type: 'close',
                              budget,
                            })
                          }
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cerrar
                        </DropdownMenuItem>
                      )}

                      {canDelete && budget.status === BudgetStatus.DRAFT && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            setConfirmAction({
                              type: 'delete',
                              budget,
                            })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation AlertDialog */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getConfirmTitle()}</AlertDialogTitle>
            <AlertDialogDescription>
              {getConfirmDescription()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={isActionLoading}
              className={
                confirmAction?.type === 'delete'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {isActionLoading
                ? 'Procesando...'
                : confirmAction?.type === 'activate'
                  ? 'Activar'
                  : confirmAction?.type === 'close'
                    ? 'Cerrar'
                    : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
