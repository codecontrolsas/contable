import { notFound } from 'next/navigation';

import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { Card, CardContent } from '@/shared/components/ui/card';
import { UrlTabsContent } from '@/shared/components/ui/url-tabs';
import { formatDateTime } from '@/shared/utils/formatters';

import { getClientDetailById, getClientAccountStatement } from './actions.server';
import { _ClientHeader } from './components/_ClientHeader';
import { _ClientDetailTabs, type ClientDetailTab } from './components/_ClientDetailTabs';
import { _GeneralInfoTab } from './components/_GeneralInfoTab';
import { _VehiclesTab } from './components/_VehiclesTab';
import { _EmployeesTab } from './components/_EmployeesTab';
import { _AccountStatementTab } from './components/_AccountStatementTab';

interface Props {
  id: string;
  searchParams?: { tab?: string };
}

export async function ClientDetail({ id, searchParams }: Props) {
  let client;
  let accountStatement;

  try {
    [client, accountStatement] = await Promise.all([
      getClientDetailById(id),
      getClientAccountStatement(id),
    ]);
  } catch {
    notFound();
  }

  const validTabs: ClientDetailTab[] = ['general', 'vehicles', 'employees', 'account'];
  const currentTab: ClientDetailTab = validTabs.includes(searchParams?.tab as ClientDetailTab)
    ? (searchParams?.tab as ClientDetailTab)
    : 'general';

  return (
    <PermissionGuard module="commercial.clients" action="view" redirect>
      <div className="space-y-6">
        <_ClientHeader client={client} />

        <_ClientDetailTabs clientId={client.id} currentTab={currentTab}>
          <UrlTabsContent value="general" className="mt-6">
            <_GeneralInfoTab client={client} />
          </UrlTabsContent>

          <UrlTabsContent value="vehicles" className="mt-6">
            <_VehiclesTab client={client} />
          </UrlTabsContent>

          <UrlTabsContent value="employees" className="mt-6">
            <_EmployeesTab client={client} />
          </UrlTabsContent>

          <UrlTabsContent value="account" className="mt-6">
            <_AccountStatementTab accountStatement={accountStatement} />
          </UrlTabsContent>
        </_ClientDetailTabs>

        {/* Timestamps */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Creado: {formatDateTime(client.createdAt)}</span>
              <span>Última actualización: {formatDateTime(client.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
