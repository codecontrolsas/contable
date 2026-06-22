'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
import type { Card } from '../../../shared/types';
import { CARD_TYPE_LABELS, CARD_OWNER_TYPE_LABELS } from '../../../shared/types';
import { deleteCard } from '../actions.server';

interface CardsTableProps {
  data: Card[];
  totalRows: number;
  searchParams: DataTableSearchParams;
  permissions: ModulePermissions;
}

export function _CardsTable({ data, totalRows, searchParams, permissions }: CardsTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingCard, setDeletingCard] = useState<Card | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      toast.success('Tarjeta eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.refresh();
    },
    onError: (error) => {
      logger.error('Error al eliminar tarjeta', { data: { error } });
      toast.error(error instanceof Error ? error.message : 'Error al eliminar tarjeta');
    },
    onSettled: () => {
      setDeletingCard(null);
    },
  });

  const handleEdit = (card: Card) => {
    router.push(`/dashboard/commercial/treasury/cards/${card.id}/edit`);
  };

  const columns = useMemo(
    () =>
      getColumns({
        onEdit: handleEdit,
        onDelete: setDeletingCard,
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
        columnId: 'cardType',
        title: 'Tipo',
        options: Object.entries(CARD_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        columnId: 'ownerType',
        title: 'Titular',
        options: Object.entries(CARD_OWNER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
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
        tableId="commercial-treasury-cards"
        facetedFilters={facetedFilters}
        showFilterToggle
        toolbarActions={
          permissions.canCreate ? (
            <Button onClick={() => router.push('/dashboard/commercial/treasury/cards/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Tarjeta
            </Button>
          ) : null
        }
      />

      <AlertDialog open={!!deletingCard} onOpenChange={(open) => !open && setDeletingCard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarjeta?</AlertDialogTitle>
            <AlertDialogDescription>
              La tarjeta &quot;{deletingCard?.name}&quot; será eliminada permanentemente. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCard && deleteMutation.mutate(deletingCard.id)}
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
