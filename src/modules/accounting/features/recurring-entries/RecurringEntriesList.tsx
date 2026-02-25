import { getActiveCompanyId } from '@/shared/lib/company';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getRecurringEntries } from './actions.server';
import { getActiveAccounts } from '../settings/actions.server';
import { _RecurringEntriesTable } from './components/_RecurringEntriesTable';

async function RecurringEntriesContent({ companyId }: { companyId: string }) {
  const [entries, accounts] = await Promise.all([
    getRecurringEntries(companyId),
    getActiveAccounts(companyId),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Asientos Recurrentes</h1>
        <p className="text-sm text-muted-foreground">
          Plantillas de asientos que se generan automáticamente según la frecuencia configurada
        </p>
      </div>

      <_RecurringEntriesTable
        companyId={companyId}
        entries={entries}
        accounts={accounts}
      />
    </div>
  );
}

export async function RecurringEntriesList() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  return (
    <PermissionGuard module="accounting.recurring-entries" action="view" redirect>
      <RecurringEntriesContent companyId={companyId} />
    </PermissionGuard>
  );
}
