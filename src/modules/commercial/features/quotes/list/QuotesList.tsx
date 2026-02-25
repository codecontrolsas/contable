import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _QuotesComingSoon } from './components/_QuotesComingSoon';

export async function QuotesList() {
  return (
    <PermissionGuard module="commercial.invoices" action="view" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-muted-foreground">
            Crea y gestiona presupuestos para tus clientes
          </p>
        </div>

        <_QuotesComingSoon />
      </div>
    </PermissionGuard>
  );
}
