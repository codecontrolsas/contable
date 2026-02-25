import { Suspense } from 'react';
import { Building2, FileType, Truck, Users } from 'lucide-react';

import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  UrlTabs,
  UrlTabsContent,
  UrlTabsList,
  UrlTabsTrigger,
} from '@/shared/components/ui/url-tabs';
import { getActiveCompanyId } from '@/shared/lib/company';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

import type { DocumentTypeTab } from '../document-types/list/actions.server';
import type { DocumentsSubTab } from './actions.server';
import { CompanyTabContent } from './components/CompanyTabContent';
import { DocumentTypesTabContent } from './components/DocumentTypesTabContent';
import { EmployeesTabContent } from './components/EmployeesTabContent';
import { EquipmentTabContent } from './components/EquipmentTabContent';
import { _DocumentsHeader } from './components/_DocumentsHeader';
import { _SubTabSkeleton } from './components/_TabSkeleton';

// ============================================
// TYPES
// ============================================

export type DocumentsTab = 'employees' | 'equipment' | 'company' | 'types';

interface Props {
  searchParams: DataTableSearchParams;
}

// ============================================
// COMPONENT
// ============================================

export async function DocumentsOverview({ searchParams }: Props) {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error('No hay empresa activa');
  }

  // Obtener tab y subtab actuales de los searchParams
  const currentTab = (searchParams.tab as DocumentsTab) || 'employees';
  const currentSubTab = (searchParams.subtab as DocumentsSubTab) || 'permanent';
  const currentDocTypeTab = (searchParams.docTypeTab as DocumentTypeTab) || 'ALL';

  return (
    <PermissionGuard module="documents" action="view" redirect>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="documents-page-title">
            Documentación
          </h1>
          <p className="text-muted-foreground">
            Gestiona los documentos de empleados, equipos y empresa
          </p>
        </div>

        {/* Botón de upload (client-side para leer tab actual) */}
        <_DocumentsHeader companyId={companyId} />
      </div>

      {/* Tabs con navegación por URL */}
      <UrlTabs
        value={currentTab}
        paramName="tab"
        resetParams={['subtab', 'page', 'docTypeTab']}
        className="space-y-6"
      >
        <UrlTabsList className="grid w-full max-w-md grid-cols-4">
          <UrlTabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Empleados</span>
          </UrlTabsTrigger>
          <UrlTabsTrigger value="equipment" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Equipos</span>
          </UrlTabsTrigger>
          <UrlTabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresa</span>
          </UrlTabsTrigger>
          <UrlTabsTrigger value="types" className="flex items-center gap-2">
            <FileType className="h-4 w-4" />
            <span className="hidden sm:inline">Tipos</span>
          </UrlTabsTrigger>
        </UrlTabsList>

        {/* Cada tab es un Server Component con su propio Suspense */}
        <UrlTabsContent value="employees">
          <Suspense fallback={<_SubTabSkeleton />}>
            <EmployeesTabContent
              searchParams={searchParams}
              currentSubTab={currentSubTab}
            />
          </Suspense>
        </UrlTabsContent>

        <UrlTabsContent value="equipment">
          <Suspense fallback={<_SubTabSkeleton />}>
            <EquipmentTabContent
              searchParams={searchParams}
              currentSubTab={currentSubTab}
            />
          </Suspense>
        </UrlTabsContent>

        <UrlTabsContent value="company">
          <Suspense fallback={<_SubTabSkeleton />}>
            <CompanyTabContent searchParams={searchParams} />
          </Suspense>
        </UrlTabsContent>

        <UrlTabsContent value="types">
          <Suspense fallback={<_SubTabSkeleton />}>
            <DocumentTypesTabContent
              searchParams={searchParams}
              currentDocTypeTab={currentDocTypeTab}
            />
          </Suspense>
        </UrlTabsContent>
      </UrlTabs>
    </div>
    </PermissionGuard>
  );
}
