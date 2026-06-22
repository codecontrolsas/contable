import { getActiveCompanyId } from '@/shared/lib/company';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getCompanyTemplates } from './actions.server';
import { _TemplatesGrid } from './components/_TemplatesGrid';
import { DOCUMENT_TEMPLATE_TYPES } from '@/shared/utils/document-template';

export async function TemplatesList() {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  const templates = await getCompanyTemplates(companyId);
  const labelsByValue = Object.fromEntries(
    DOCUMENT_TEMPLATE_TYPES.map((t) => [t.value, t.label])
  );

  return (
    <PermissionGuard module="company.documents" action="view" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plantillas de Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza la apariencia de los comprobantes emitidos. Si no configurás
            ninguno, se usa el tema Clásico por defecto.
          </p>
        </div>
        <_TemplatesGrid
          templates={templates.map((t) => ({
            documentType: t.documentType,
            theme: t.theme,
            primaryColor: t.primaryColor,
            updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
            label: labelsByValue[t.documentType] ?? t.documentType,
          }))}
        />
      </div>
    </PermissionGuard>
  );
}