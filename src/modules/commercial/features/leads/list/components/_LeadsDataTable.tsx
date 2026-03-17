'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  DataTable,
  type DataTableFacetedFilterConfig,
  type DataTableSearchParams,
} from '@/shared/components/common/DataTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import type { ModulePermissions } from '@/shared/lib/permissions';
import { getColumns, leadStatusLabels } from '../columns';
import { _LeadFormModal } from './_LeadFormModal';
import { _ConvertLeadModal } from './_ConvertLeadModal';
import {
  deleteLead,
  updateLeadStatus,
  type LeadListItem,
} from '../actions.server';
import type { LeadStatus } from '@/generated/prisma/enums';

interface FacetCounts {
  status: Record<string, number>;
}

interface Props {
  data: LeadListItem[];
  totalRows: number;
  searchParams: DataTableSearchParams;
  permissions: ModulePermissions;
  facetCounts?: FacetCounts;
}

export function _LeadsDataTable({
  data,
  totalRows,
  searchParams,
  permissions,
  facetCounts,
}: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadListItem | null>(null);
  const [convertingLead, setConvertingLead] = useState<LeadListItem | null>(null);
  const [deletingLead, setDeletingLead] = useState<LeadListItem | null>(null);

  const handleRefresh = () => {
    router.refresh();
  };

  const handleUpdateStatus = async (lead: LeadListItem, status: LeadStatus) => {
    try {
      await updateLeadStatus(lead.id, status);
      toast.success('Estado actualizado exitosamente');
      handleRefresh();
    } catch {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleDelete = async () => {
    if (!deletingLead) return;
    try {
      await deleteLead(deletingLead.id);
      toast.success('Lead eliminado exitosamente');
      handleRefresh();
    } catch {
      toast.error('Error al eliminar el lead');
    } finally {
      setDeletingLead(null);
    }
  };

  const columns = useMemo(
    () =>
      getColumns({
        onEdit: setEditingLead,
        onConvert: setConvertingLead,
        onUpdateStatus: handleUpdateStatus,
        onDelete: setDeletingLead,
        permissions,
      }),
    [permissions]
  );

  const facetedFilters = useMemo<DataTableFacetedFilterConfig[]>(
    () => [
      {
        columnId: 'name',
        title: 'Nombre',
        type: 'text' as const,
        placeholder: 'Buscar por nombre...',
      },
      {
        columnId: 'email',
        title: 'Email',
        type: 'text' as const,
        placeholder: 'Buscar por email...',
      },
      {
        columnId: 'phone',
        title: 'Teléfono',
        type: 'text' as const,
        placeholder: 'Buscar por teléfono...',
      },
      {
        columnId: 'status',
        title: 'Estado',
        options: Object.entries(leadStatusLabels).map(([value, label]) => ({
          value,
          label,
        })),
        externalCounts: facetCounts?.status ? new Map(Object.entries(facetCounts.status)) : undefined,
      },
      {
        columnId: 'createdAt',
        title: 'Fecha de Creación',
        type: 'dateRange' as const,
      },
    ],
    [facetCounts]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        totalRows={totalRows}
        searchParams={searchParams}
        showSearch={false}
        tableId="commercial-leads"
        facetedFilters={facetedFilters}
        showFilterToggle
        toolbarActions={
          permissions.canCreate ? (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Lead
            </Button>
          ) : null
        }
      />

      {/* Modal de crear/editar */}
      <_LeadFormModal
        open={isCreateOpen || !!editingLead}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingLead(null);
          }
        }}
        lead={editingLead}
        onSuccess={handleRefresh}
      />

      {/* Modal de conversión */}
      <_ConvertLeadModal
        open={!!convertingLead}
        onOpenChange={(open) => !open && setConvertingLead(null)}
        lead={convertingLead}
        onSuccess={handleRefresh}
      />

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog
        open={!!deletingLead}
        onOpenChange={(open) => !open && setDeletingLead(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              El lead "{deletingLead?.name}" será eliminado.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
