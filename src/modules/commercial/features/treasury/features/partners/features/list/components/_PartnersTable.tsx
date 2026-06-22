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
import { logger } from '@/shared/lib/logger';
import { getColumns } from '../columns';
import type { PartnerWithBalance } from '../../../shared/types';
import { deletePartner } from '../actions.server';

interface FacetCounts {
  isActive: Record<string, number>;
}

interface PartnersTableProps {
  data: PartnerWithBalance[];
  totalRows: number;
  searchParams: DataTableSearchParams;
  permissions: ModulePermissions;
  facetCounts?: FacetCounts;
}

export function _PartnersTable({
  data,
  totalRows,
  searchParams,
  permissions,
  facetCounts,
}: PartnersTableProps) {
  const router = useRouter();
  const [deletingPartner, setDeletingPartner] = useState<PartnerWithBalance | null>(null);

  const handleEdit = (partner: PartnerWithBalance) => {
    router.push(`/dashboard/commercial/treasury/partners/${partner.id}/edit`);
  };

  const handleDelete = async () => {
    if (!deletingPartner) return;
    try {
      await deletePartner(deletingPartner.id);
      toast.success('Socio eliminado correctamente');
      router.refresh();
    } catch (error) {
      logger.error('Error al eliminar socio', { data: { error } });
      const message = error instanceof Error ? error.message : 'Error al eliminar socio';
      toast.error(message);
    } finally {
      setDeletingPartner(null);
    }
  };

  const columns = useMemo(
    () =>
      getColumns({
        onEdit: handleEdit,
        onDelete: setDeletingPartner,
        permissions,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        columnId: 'taxId',
        title: 'CUIT/CUIL',
        type: 'text' as const,
        placeholder: 'Buscar por CUIT/CUIL...',
      },
      {
        columnId: 'isActive',
        title: 'Estado',
        options: [
          { value: 'true', label: 'Activo' },
          { value: 'false', label: 'Inactivo' },
        ],
        externalCounts: facetCounts?.isActive
          ? new Map(Object.entries(facetCounts.isActive))
          : undefined,
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
        tableId="commercial-treasury-partners"
        facetedFilters={facetedFilters}
        showFilterToggle
        toolbarActions={
          permissions.canCreate ? (
            <Button
              onClick={() => router.push('/dashboard/commercial/treasury/partners/new')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Socio
            </Button>
          ) : null
        }
      />

      <AlertDialog
        open={!!deletingPartner}
        onOpenChange={(open) => !open && setDeletingPartner(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este socio?</AlertDialogTitle>
            <AlertDialogDescription>
              El socio &quot;{deletingPartner?.name}&quot; será eliminado permanentemente.
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
