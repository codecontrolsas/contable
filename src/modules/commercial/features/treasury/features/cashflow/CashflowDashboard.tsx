import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getCashflowData, type Granularity } from './actions.server';
import { _CashflowSummaryCards } from './components/_CashflowSummaryCards';
import { _CashflowChart } from './components/_CashflowChart';
import { _CashflowTable } from './components/_CashflowTable';
import { _GranularitySelector } from './components/_GranularitySelector';

interface Props {
  granularity?: Granularity;
  month?: string;
}

export async function CashflowDashboard({ granularity = 'weekly', month }: Props) {
  const data = await getCashflowData(granularity, month);

  return (
    <PermissionGuard module="commercial.treasury.cashflow" action="view" redirect>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flujo de Caja</h1>
          <p className="text-muted-foreground">
            Proyección financiera basada en documentos pendientes, cheques y proyecciones manuales
          </p>
        </div>
        <_GranularitySelector />
      </div>

      <_CashflowSummaryCards summary={data.summary} />
      <_CashflowChart data={data.rows} />
      <_CashflowTable data={data.rows} />
    </div>
    </PermissionGuard>
  );
}
