'use client';

import { CardTitle } from '@/shared/components/ui/card';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Receipt } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/formatters';
import moment from 'moment';
import { _CollapsibleCard } from './_CollapsibleCard';

interface Alert {
  type: 'overdue_receivable' | 'overdue_payable' | 'overdue_expense';
  title: string;
  description: string;
  date: Date | null;
  amount: number;
}

interface AlertsListProps {
  alerts: Alert[];
  defaultOpen?: boolean;
}

const alertIcons = {
  overdue_receivable: ArrowDownCircle,
  overdue_payable: ArrowUpCircle,
  overdue_expense: Receipt,
};

const alertColors = {
  overdue_receivable: 'text-orange-500',
  overdue_payable: 'text-red-500',
  overdue_expense: 'text-red-400',
};

export function _AlertsList({ alerts, defaultOpen }: AlertsListProps) {
  return (
    <_CollapsibleCard header={<CardTitle className="text-base">Alertas y Vencimientos</CardTitle>} defaultOpen={defaultOpen}>
        {alerts.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p className="text-sm">No hay alertas pendientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, idx) => {
              const Icon = alertIcons[alert.type];
              const color = alertColors[alert.type];
              return (
                <div key={idx} className="flex items-start gap-3 rounded-md border p-2">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{alert.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{formatCurrency(alert.amount)}</p>
                    {alert.date && (
                      <p className="text-xs text-red-500">
                        Venció {moment(alert.date).format('DD/MM')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </_CollapsibleCard>
  );
}
