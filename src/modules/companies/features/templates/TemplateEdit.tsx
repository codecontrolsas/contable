import { notFound } from 'next/navigation';
import { getActiveCompanyId } from '@/shared/lib/company';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getCompanyTemplates } from './actions.server';
import { _TemplateForm } from './components/_TemplateForm';
import { DOCUMENT_TEMPLATE_TYPES } from '@/shared/utils/document-template';

interface Props {
  documentType: string;
}

export async function TemplateEdit({ documentType }: Props) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  const typeInfo = DOCUMENT_TEMPLATE_TYPES.find(
    (t) => t.value.toLowerCase() === documentType.toLowerCase()
  );

  if (!typeInfo) {
    notFound();
  }

  const templates = await getCompanyTemplates(companyId);
  const template = templates.find((t: { documentType: string }) => t.documentType === typeInfo.value);

  if (!template) {
    notFound();
  }

  return (
    <PermissionGuard module="company.documents" action="update" redirect>
      <_TemplateForm
        documentType={template.documentType}
        label={typeInfo.label}
        defaults={{
          theme: template.theme,
          primaryColor: template.primaryColor,
          headerText: template.headerText,
          footerText: template.footerText,
          notesDefault: template.notesDefault,
          showCae: template.showCae,
          showNotes: template.showNotes,
          showWithholdings: template.showWithholdings,
          showIssuer: template.showIssuer,
          showReceiver: template.showReceiver,
          isCustomized: template.id !== null,
        }}
      />
    </PermissionGuard>
  );
}