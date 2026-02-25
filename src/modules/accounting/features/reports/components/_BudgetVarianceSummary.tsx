'use client';

import {
  Card,
  CardContent,
} from '@/shared/components/ui/card';
import { formatAmount } from '../../../shared/utils';

interface BudgetVarianceSummaryProps {
  data: {
    revenue: {
      totalBudgeted: number;
      totalExecuted: number;
    };
    expenses: {
      totalBudgeted: number;
      totalExecuted: number;
    };
    netBudgeted: number;
    netExecuted: number;
    netVariance: number;
    netVariancePercent: number;
  };
}

export function _BudgetVarianceSummary({ data }: BudgetVarianceSummaryProps) {
  const totalBudgeted = data.revenue.totalBudgeted + data.expenses.totalBudgeted;
  const totalExecuted = data.revenue.totalExecuted + data.expenses.totalExecuted;
  const globalPercent =
    totalBudgeted === 0
      ? 0
      : (totalExecuted / totalBudgeted) * 100;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            Total Presupuestado
          </div>
          <div className="text-2xl font-bold">
            {formatAmount(totalBudgeted)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Ejecutado</div>
          <div className="text-2xl font-bold">
            {formatAmount(totalExecuted)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Variación Total</div>
          <div
            className={`text-2xl font-bold ${
              data.netVariance >= 0 ? 'text-green-600' : 'text-destructive'
            }`}
          >
            {formatAmount(data.netVariance)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            % Ejecución Global
          </div>
          <div
            className={`text-2xl font-bold ${
              globalPercent <= 80
                ? 'text-green-600'
                : globalPercent <= 100
                  ? 'text-yellow-600'
                  : 'text-destructive'
            }`}
          >
            {globalPercent.toFixed(1)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
