import { getActiveCompanyId } from '@/shared/lib/company';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getOpeningBalancesPageData } from './actions.server';
import { _OpeningBalancesTabs } from './components/_OpeningBalancesTabs';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';

async function OpeningBalancesContent() {
  const data = await getOpeningBalancesPageData();

  if (!data.hasFiscalYear) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Saldos de Apertura</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Requisito previo</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Configurá el ejercicio fiscal antes de cargar saldos de apertura.
            </p>
            <Link href="/dashboard/company/accounting/settings">
              <Button variant="outline" size="sm">
                Ir a Configuración Contable
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data.hasChartOfAccounts) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Saldos de Apertura</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Requisito previo</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Creá o importá el plan de cuentas antes de cargar saldos de
              apertura.
            </p>
            <Link href="/dashboard/company/accounting/accounts">
              <Button variant="outline" size="sm">
                Ir a Plan de Cuentas
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Saldos de Apertura</h1>
        <p className="text-sm text-muted-foreground">
          Migrá los saldos iniciales y comprobantes pendientes de tu sistema
          anterior
        </p>
      </div>

      <_OpeningBalancesTabs data={data} />
    </div>
  );
}

export async function OpeningBalancesPage() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  return (
    <PermissionGuard module="accounting.opening-balances" action="view" redirect>
      <OpeningBalancesContent />
    </PermissionGuard>
  );
}
