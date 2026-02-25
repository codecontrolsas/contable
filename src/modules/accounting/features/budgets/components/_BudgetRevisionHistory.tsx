'use client';

import moment from 'moment';
import { History } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { formatAmount } from '../../../shared/utils';

interface Revision {
  id: string;
  previousAmounts: number[];
  newAmounts: number[];
  previousTotal: number;
  newTotal: number;
  reason: string;
  createdBy: string;
  createdAt: Date;
}

interface BudgetRevisionHistoryProps {
  revisions: Revision[];
  monthLabels: string[];
}

export function _BudgetRevisionHistory({
  revisions,
  monthLabels,
}: BudgetRevisionHistoryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">
          Historial de Revisiones ({revisions.length})
        </h3>
      </div>

      <div className="space-y-3">
        {revisions.map((revision) => (
          <Card key={revision.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-medium">
                  {moment(revision.createdAt).format('DD/MM/YYYY HH:mm')}
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  Total: {formatAmount(revision.previousTotal)} &rarr;{' '}
                  <span className="font-medium text-foreground">
                    {formatAmount(revision.newTotal)}
                  </span>
                  {' '}
                  ({revision.newTotal >= revision.previousTotal ? '+' : ''}
                  {formatAmount(revision.newTotal - revision.previousTotal)})
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="mb-3 text-sm">
                <span className="font-medium">Motivo:</span> {revision.reason}
              </p>

              {/* Compact comparison of changed months */}
              <div className="rounded-md border">
                <div className="grid grid-cols-4 gap-0 border-b bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>Mes</span>
                  <span className="text-right">Anterior</span>
                  <span className="text-right">Nuevo</span>
                  <span className="text-right">Diferencia</span>
                </div>
                <div className="max-h-[200px] overflow-auto">
                  {monthLabels.map((label, index) => {
                    const prev = revision.previousAmounts[index];
                    const next = revision.newAmounts[index];
                    const diff = next - prev;
                    const hasChanged = prev !== next;

                    if (!hasChanged) return null;

                    return (
                      <div
                        key={index}
                        className="grid grid-cols-4 gap-0 border-b px-3 py-1.5 text-sm last:border-b-0"
                      >
                        <span className="capitalize">{label}</span>
                        <span className="text-right text-muted-foreground">
                          {formatAmount(prev)}
                        </span>
                        <span className="text-right font-medium">
                          {formatAmount(next)}
                        </span>
                        <span
                          className={`text-right ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {diff > 0 ? '+' : ''}
                          {formatAmount(diff)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
