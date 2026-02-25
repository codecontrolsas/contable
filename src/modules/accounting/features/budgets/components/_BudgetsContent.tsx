'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { usePermissions } from '@/shared/hooks/usePermissions';

import { getAvailableFiscalYears } from '../actions.server';
import { _BudgetsTable } from './_BudgetsTable';
import { _CreateBudgetModal } from './_CreateBudgetModal';
import { _BudgetDetailModal } from './_BudgetDetailModal';

interface BudgetsContentProps {
  currentFiscalYear: number;
  fiscalYearStart: Date;
}

export function _BudgetsContent({
  currentFiscalYear,
  fiscalYearStart,
}: BudgetsContentProps) {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('accounting.budgets', 'create');
  const [selectedFiscalYear, setSelectedFiscalYear] =
    useState<number>(currentFiscalYear);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailBudgetId, setDetailBudgetId] = useState<string | null>(null);
  const { data: fiscalYears, isLoading: isLoadingYears } = useQuery({
    queryKey: ['available-fiscal-years'],
    queryFn: () => getAvailableFiscalYears(),
  });

  const handleViewDetail = (budgetId: string) => {
    setDetailBudgetId(budgetId);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Presupuestos Contables</CardTitle>
              <CardDescription>
                Presupuestos por cuenta de resultado y periodo fiscal
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isLoadingYears ? (
                <Skeleton className="h-9 w-[120px]" />
              ) : (
                <Select
                  value={String(selectedFiscalYear)}
                  onValueChange={(val) => setSelectedFiscalYear(Number(val))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Ano fiscal" />
                  </SelectTrigger>
                  <SelectContent>
                    {(fiscalYears ?? [currentFiscalYear]).map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canCreate && (
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Presupuesto
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <_BudgetsTable
            fiscalYear={selectedFiscalYear}
            onViewDetail={handleViewDetail}
          />
        </CardContent>
      </Card>

      <_CreateBudgetModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        fiscalYear={selectedFiscalYear}
        fiscalYearStart={fiscalYearStart}
      />

      <_BudgetDetailModal
        open={detailBudgetId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailBudgetId(null);
        }}
        budgetId={detailBudgetId}
        onBudgetChanged={() => {
          // Detail modal handles its own query invalidation
        }}
      />
    </>
  );
}
