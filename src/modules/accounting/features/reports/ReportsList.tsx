import { getActiveCompanyId } from '@/shared/lib/company';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { _ReportsContent } from './components/_ReportsContent';

export async function ReportsList() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  return (
    <PermissionGuard module="accounting.reports" action="view" redirect>
      <_ReportsContent companyId={companyId} />
    </PermissionGuard>
  );
}
