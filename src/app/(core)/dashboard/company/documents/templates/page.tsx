import { TemplatesList } from '@/modules/companies/features/templates';
import { checkPermission } from '@/shared/lib/permissions';

export default async function TemplatesPage() {
  await checkPermission('company.documents', 'view', { redirect: true });

  return <TemplatesList />;
}