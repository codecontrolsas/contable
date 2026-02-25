'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { formatAmount } from '../../../shared/utils';
import { cn } from '@/shared/lib/utils';

interface BudgetMonthlyTableProps {
  monthLabels: string[];
  monthlyAmounts: number[];
  monthlyExecuted: number[];
  monthlyVariance: number[];
  monthlyVariancePercent: number[];
  totalAmount: number;
  totalExecuted: number;
  totalVariance: number;
  totalVariancePercent: number;
  accountType: string;
}

/**
 * Returns the color class based on execution percentage.
 * For EXPENSE: under budget is green, over budget is red.
 * For REVENUE: over budget (more income) is green, under budget is red.
 */
function getVarianceColor(
  variancePercent: number,
  accountType: string
): string {
  // variancePercent = ((budgeted - executed) / budgeted) * 100
  // Positive = under budget, Negative = over budget
  const executedPercent = 100 - variancePercent;

  if (accountType === 'REVENUE') {
    // For revenue, more execution is favorable
    if (executedPercent > 100) return 'text-green-600';
    if (executedPercent >= 80) return 'text-yellow-600';
    return 'text-red-600';
  }

  // For expense, less execution is favorable
  if (executedPercent > 100) return 'text-red-600';
  if (executedPercent >= 80) return 'text-yellow-600';
  return 'text-green-600';
}

export function _BudgetMonthlyTable({
  monthLabels,
  monthlyAmounts,
  monthlyExecuted,
  monthlyVariance,
  monthlyVariancePercent,
  totalAmount,
  totalExecuted,
  totalVariance,
  totalVariancePercent,
  accountType,
}: BudgetMonthlyTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Mes</TableHead>
            <TableHead className="text-right">Presupuestado</TableHead>
            <TableHead className="text-right">Ejecutado</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Desvio ($)
            </TableHead>
            <TableHead className="text-right">Desvio (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthLabels.map((label, index) => {
            const budgeted = monthlyAmounts[index];
            const colorClass =
              budgeted === 0 && monthlyExecuted[index] === 0
                ? 'text-muted-foreground'
                : getVarianceColor(monthlyVariancePercent[index], accountType);

            return (
              <TableRow key={index}>
                <TableCell className="font-medium capitalize">
                  {label}
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(budgeted)}
                </TableCell>
                <TableCell className={cn('text-right', colorClass)}>
                  {formatAmount(monthlyExecuted[index])}
                </TableCell>
                <TableCell
                  className={cn(
                    'hidden text-right sm:table-cell',
                    colorClass
                  )}
                >
                  {formatAmount(monthlyVariance[index])}
                </TableCell>
                <TableCell className={cn('text-right', colorClass)}>
                  {monthlyVariancePercent[index].toFixed(1)}%
                </TableCell>
              </TableRow>
            );
          })}

          {/* Totals row */}
          <TableRow className="border-t-2 bg-muted/50 font-bold">
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">
              {formatAmount(totalAmount)}
            </TableCell>
            <TableCell
              className={cn(
                'text-right font-bold',
                totalAmount === 0 && totalExecuted === 0
                  ? 'text-muted-foreground'
                  : getVarianceColor(totalVariancePercent, accountType)
              )}
            >
              {formatAmount(totalExecuted)}
            </TableCell>
            <TableCell
              className={cn(
                'hidden text-right font-bold sm:table-cell',
                totalAmount === 0 && totalExecuted === 0
                  ? 'text-muted-foreground'
                  : getVarianceColor(totalVariancePercent, accountType)
              )}
            >
              {formatAmount(totalVariance)}
            </TableCell>
            <TableCell
              className={cn(
                'text-right font-bold',
                totalAmount === 0 && totalExecuted === 0
                  ? 'text-muted-foreground'
                  : getVarianceColor(totalVariancePercent, accountType)
              )}
            >
              {totalVariancePercent.toFixed(1)}%
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
