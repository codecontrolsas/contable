import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Wallet, Landmark, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/formatters';
import { getChecksPaginated, getCheckFacetCounts } from '../actions.server';
import { _ChecksTable } from './components/_ChecksTable';

interface Props {
  searchParams?: DataTableSearchParams;
}

export async function ChecksList({ searchParams = {} }: Props) {
  const [{ data, totalRows }, facetCounts] = await Promise.all([
    getChecksPaginated(searchParams),
    getCheckFacetCounts(),
  ]);

  // KPIs
  const inPortfolio = data.filter((c) => c.status === 'PORTFOLIO');
  const portfolioTotal = inPortfolio.reduce((acc, c) => acc + c.amount, 0);
  const deposited = data.filter((c) => c.status === 'DEPOSITED');
  const depositedTotal = deposited.reduce((acc, c) => acc + c.amount, 0);
  const overdue = data.filter(
    (c) =>
      ['PORTFOLIO', 'DEPOSITED', 'DELIVERED'].includes(c.status) &&
      new Date(c.dueDate) < new Date()
  );

  return (
    <PermissionGuard module="commercial.treasury.checks" action="view" redirect>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cheques</h1>
        <p className="text-muted-foreground">Gestión de cartera de cheques propios y de terceros</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Cartera</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(portfolioTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {inPortfolio.length} cheque{inPortfolio.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depositados</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(depositedTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {deposited.length} cheque{deposited.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdue.length > 0 ? 'text-yellow-600' : ''}`}>
              {overdue.length}
            </div>
            <p className="text-xs text-muted-foreground">
              cheque{overdue.length !== 1 ? 's' : ''} vencido{overdue.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <_ChecksTable data={data} totalRows={totalRows} searchParams={searchParams} facetCounts={facetCounts} />
    </div>
    </PermissionGuard>
  );
}
