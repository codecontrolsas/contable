'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, Users, Unlink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  DataTable,
  type DataTableSearchParams,
  type DataTableFacetedFilterConfig,
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
import { getColumns } from '../columns';
import { _ContactFormModal } from './_ContactFormModal';
import {
  deleteContact,
  type ContactListItem,
  type ContactFormOptions,
} from '../actions.server';

interface Props {
  data: ContactListItem[];
  totalRows: number;
  searchParams: DataTableSearchParams;
  options: ContactFormOptions;
  permissions: ModulePermissions;
}

export function _ContactsDataTable({ data, totalRows, searchParams, options, permissions }: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactListItem | null>(null);
  const [deletingContact, setDeletingContact] = useState<ContactListItem | null>(null);

  const handleRefresh = () => {
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deletingContact) return;
    try {
      await deleteContact(deletingContact.id);
      toast.success('Contacto eliminado exitosamente');
      handleRefresh();
    } catch {
      toast.error('Error al eliminar el contacto');
    } finally {
      setDeletingContact(null);
    }
  };

  const columns = useMemo(
    () =>
      getColumns({
        onEdit: setEditingContact,
        onDelete: setDeletingContact,
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
        columnId: 'linkedTo',
        title: 'Vinculado a',
        options: [
          { value: 'client', label: 'Cliente', icon: Building2 },
          { value: 'lead', label: 'Lead', icon: Users },
          { value: 'none', label: 'Sin vincular', icon: Unlink },
        ],
      },
    ],
    []
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        totalRows={totalRows}
        searchParams={searchParams}
        showSearch={false}
        tableId="commercial-contacts"
        facetedFilters={facetedFilters}
        showFilterToggle
        toolbarActions={
          permissions.canCreate ? (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Contacto
            </Button>
          ) : null
        }
      />

      {/* Modal de crear/editar */}
      <_ContactFormModal
        open={isCreateOpen || !!editingContact}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingContact(null);
          }
        }}
        contact={editingContact}
        options={options}
        onSuccess={handleRefresh}
      />

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog
        open={!!deletingContact}
        onOpenChange={(open) => !open && setDeletingContact(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              El contacto "{deletingContact?.firstName} {deletingContact?.lastName}" será eliminado.
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
