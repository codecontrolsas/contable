'use client';

import { formatAmount } from '../../../shared/utils';

interface VarianceAccount {
  code: string;
  name: string;
  budgeted: number;
  executed: number;
  variance: number;
  variancePercent: number;
}

interface BudgetVarianceTableProps {
  title: string;
  section: {
    accounts: VarianceAccount[];
    totalBudgeted: number;
    totalExecuted: number;
    totalVariance: number;
    totalVariancePercent: number;
  };
  type: 'revenue' | 'expense';
}

/**
 * Determina la clase CSS de color para el desvío.
 * Para REVENUE: ejecutado > presupuestado es favorable (verde)
 * Para EXPENSE: ejecutado > presupuestado es desfavorable (rojo)
 */
function getVarianceColorClass(
  variance: number,
  type: 'revenue' | 'expense'
): string {
  if (variance === 0) return 'text-muted-foreground';

  if (type === 'revenue') {
    // Para ingresos: varianza negativa (ejecutado > presupuestado) es favorable
    return variance < 0 ? 'text-green-600' : 'text-red-600';
  }
  // Para gastos: varianza positiva (ejecutado < presupuestado) es favorable
  return variance > 0 ? 'text-green-600' : 'text-red-600';
}

export function _BudgetVarianceTable({
  title,
  section,
  type,
}: BudgetVarianceTableProps) {
  const totalColorClass = type === 'revenue' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted px-4 py-3">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 pl-4 text-left">Código</th>
              <th className="py-3 text-left">Cuenta</th>
              <th className="py-3 pr-4 text-right">Presupuestado</th>
              <th className="py-3 pr-4 text-right">Ejecutado</th>
              <th className="hidden py-3 pr-4 text-right sm:table-cell">
                Desvío ($)
              </th>
              <th className="py-3 pr-4 text-right">Desvío (%)</th>
            </tr>
          </thead>
          <tbody>
            {section.accounts.length > 0 ? (
              section.accounts.map((account) => {
                const colorClass = getVarianceColorClass(
                  account.variance,
                  type
                );
                return (
                  <tr key={account.code} className="border-b">
                    <td className="py-2 pl-4 font-mono text-sm">
                      {account.code}
                    </td>
                    <td className="py-2">{account.name}</td>
                    <td className="py-2 pr-4 text-right">
                      {formatAmount(account.budgeted)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatAmount(account.executed)}
                    </td>
                    <td
                      className={`hidden py-2 pr-4 text-right sm:table-cell ${colorClass}`}
                    >
                      {formatAmount(account.variance)}
                    </td>
                    <td className={`py-2 pr-4 text-right ${colorClass}`}>
                      {account.variancePercent.toFixed(1)}%
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-4 text-center text-muted-foreground"
                >
                  No hay presupuestos activos de {title.toLowerCase()} para este
                  ejercicio
                </td>
              </tr>
            )}
            <tr className="border-t bg-muted/30 font-medium">
              <td className="py-3 pl-4" colSpan={2}>
                Total {title}
              </td>
              <td className={`py-3 pr-4 text-right ${totalColorClass}`}>
                {formatAmount(section.totalBudgeted)}
              </td>
              <td className={`py-3 pr-4 text-right ${totalColorClass}`}>
                {formatAmount(section.totalExecuted)}
              </td>
              <td
                className={`hidden py-3 pr-4 text-right sm:table-cell ${getVarianceColorClass(section.totalVariance, type)}`}
              >
                {formatAmount(section.totalVariance)}
              </td>
              <td
                className={`py-3 pr-4 text-right ${getVarianceColorClass(section.totalVariance, type)}`}
              >
                {section.totalVariancePercent.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
