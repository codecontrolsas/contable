import { TemplateEdit } from '@/modules/companies/features/templates';
import { checkPermission } from '@/shared/lib/permissions';

interface Props {
  params: Promise<{ type: string }>;
}

export default async function TemplateEditPage({ params }: Props) {
  await checkPermission('company.documents', 'view', { redirect: true });
  const { type } = await params;

  return <TemplateEdit documentType={type.toUpperCase().replace(/-/g, '_')} />;
}