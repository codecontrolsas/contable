import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getModulePermissions } from '@/shared/lib/permissions';
import { getCards } from './actions.server';
import { _CardsTable } from './components/_CardsTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function CardsList({ searchParams = {} }: Props) {
  const [result, permissions] = await Promise.all([
    getCards(searchParams),
    getModulePermissions('commercial.treasury.cards'),
  ]);

  return (
    <PermissionGuard module="commercial.treasury.cards" action="view" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tarjetas</h1>
          <p className="text-muted-foreground">
            Gestiona las tarjetas de débito y crédito de tu empresa y socios
          </p>
        </div>

        <_CardsTable
          data={result.data}
          totalRows={result.pagination.total}
          searchParams={searchParams}
          permissions={permissions}
        />
      </div>
    </PermissionGuard>
  );
}
