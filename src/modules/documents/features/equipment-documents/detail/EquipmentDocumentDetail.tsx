import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/shared/components/ui/resizable';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

import { getEquipmentDocumentDetailById } from './actions.server';
import { _EquipmentDocumentActions } from './components/_EquipmentDocumentActions';
import { _EquipmentDocumentInfo } from './components/_EquipmentDocumentInfo';
import { _EquipmentDocumentPreview } from './components/_EquipmentDocumentPreview';
import { _MobilePreviewButton } from './components/_MobilePreviewButton';

// ============================================
// PROPS
// ============================================

interface Props {
  equipmentId: string;
  documentId: string;
}

// ============================================
// COMPONENT
// ============================================

export async function EquipmentDocumentDetail({ equipmentId, documentId }: Props) {
  let data;

  try {
    data = await getEquipmentDocumentDetailById(documentId, equipmentId);
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  const { document, equipment, previewUrl } = data;

  // Verificar si hay versiones anteriores que se puedan restaurar
  // Buscar entradas en el historial que tengan un archivo diferente al actual
  const hasPreviousVersions =
    document.history?.some(
      (entry, index) =>
        index > 0 && entry.documentKey && entry.documentKey !== document.documentKey
    ) ?? false;

  // Construir display name del equipo
  const equipmentDisplayName = equipment.domain
    ? `${equipment.internNumber} - ${equipment.domain}`
    : equipment.internNumber;

  const equipmentSubtitle = [
    equipment.brand?.name,
    equipment.model?.name,
    equipment.type?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PermissionGuard module="documents" action="view" redirect>
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4 mb-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/equipment/${equipmentId}?tab=documents`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{document.documentType.name}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {equipmentDisplayName} {equipmentSubtitle && `· ${equipmentSubtitle}`}
          </p>
        </div>
      </div>

      {/* Mobile Layout - Solo info con botón para ver preview */}
      <div className="flex-1 md:hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 pb-6">
            {/* Botón para ver documento en mobile */}
            <_MobilePreviewButton
              url={previewUrl}
              fileName={document.fileName}
              mimeType={document.mimeType}
            />

            <_EquipmentDocumentActions
              documentId={documentId}
              equipmentId={equipmentId}
              documentTypeId={document.documentTypeId}
              documentTypeName={document.documentType.name}
              documentTypeHasExpiration={document.documentType.hasExpiration}
              documentTypeIsMonthly={document.documentType.isMonthly}
              documentState={document.state}
              fileName={document.fileName}
              hasFile={!!document.documentKey}
              hasPreviousVersions={hasPreviousVersions}
            />

            <_EquipmentDocumentInfo data={data} />
          </div>
        </ScrollArea>
      </div>

      {/* Desktop Layout - Resizable Panels */}
      <div className="hidden md:flex flex-1">
        <ResizablePanelGroup orientation="horizontal" className="flex-1 rounded-lg border">
        {/* Preview Panel */}
        <ResizablePanel defaultSize={60} minSize={40}>
          <div className="h-full p-4">
            <_EquipmentDocumentPreview
              url={previewUrl}
              fileName={document.fileName}
              mimeType={document.mimeType}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Info Panel */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="h-full overflow-auto p-4">
            <div className="space-y-6">
              <_EquipmentDocumentActions
                documentId={documentId}
                equipmentId={equipmentId}
                documentTypeId={document.documentTypeId}
                documentTypeName={document.documentType.name}
                documentTypeHasExpiration={document.documentType.hasExpiration}
                documentTypeIsMonthly={document.documentType.isMonthly}
                documentState={document.state}
                fileName={document.fileName}
                hasFile={!!document.documentKey}
                hasPreviousVersions={hasPreviousVersions}
              />
              <_EquipmentDocumentInfo data={data} />
            </div>
          </div>
        </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
    </PermissionGuard>
  );
}
