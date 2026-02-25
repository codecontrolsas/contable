import { getActiveCompanyId } from '@/shared/lib/company';
import { getBudgetsPageData } from './actions.server';
import { _BudgetsContent } from './components/_BudgetsContent';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

async function BudgetsPageContent() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  const data = await getBudgetsPageData();

  if (!data.hasSettings) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            Control presupuestario por cuenta contable y periodo fiscal
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Requisito previo</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Configura el ejercicio fiscal antes de gestionar presupuestos.
            </p>
            <Link href="/dashboard/company/accounting/settings">
              <Button variant="outline" size="sm">
                Ir a Configuracion Contable
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data.hasResultAccounts) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            Control presupuestario por cuenta contable y periodo fiscal
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Requisito previo</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Crea cuentas de resultado (Ingresos o Gastos) en el Plan de
              Cuentas antes de crear presupuestos.
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
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <p className="text-sm text-muted-foreground">
          Control presupuestario por cuenta contable y periodo fiscal
        </p>
      </div>

      <_BudgetsContent
        currentFiscalYear={data.currentFiscalYear}
        fiscalYearStart={
          data.settings!.fiscalYearStart
        }
      />
    </div>
  );
}

export async function BudgetsPage() {
  return (
    <PermissionGuard module="accounting.budgets" action="view" redirect>
      <BudgetsPageContent />
    </PermissionGuard>
  );
}
