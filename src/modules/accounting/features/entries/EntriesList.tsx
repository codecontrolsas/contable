import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getJournalEntries } from './actions.server';
import { _EntriesTable } from './components/_EntriesTable';
import { _CreateEntryButton } from './components/_CreateEntryButton';

import { getActiveCompanyId } from '@/shared/lib/company';

export async function EntriesList() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  return (
    <PermissionGuard module="accounting.entries" action="view" redirect>
      <EntriesListContent companyId={companyId} />
    </PermissionGuard>
  );
}

async function EntriesListContent({ companyId }: { companyId: string }) {
  const rawEntries = await getJournalEntries(companyId);

  // Mapear Decimal a number para compatibilidad con tipos
  const entries = rawEntries.map(entry => ({
    ...entry,
    lines: entry.lines.map(line => ({
      ...line,
      debit: Number(line.debit),
      credit: Number(line.credit),
    })),
  }));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Libro Diario</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los asientos contables de tu empresa
          </p>
        </div>
        <PermissionGuard module="accounting.entries" action="create">
          <_CreateEntryButton />
        </PermissionGuard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asientos Contables</CardTitle>
          <CardDescription>
            Lista de asientos contables ordenados por fecha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <_EntriesTable entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
