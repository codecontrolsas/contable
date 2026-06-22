'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, CreditCard, Building2, User, Edit, Trash2 } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { DataTableColumnHeader } from '@/shared/components/common/DataTable';
import type { ModulePermissions } from '@/shared/lib/permissions';
import type { Card } from '../../shared/types';
import { CARD_TYPE_LABELS } from '../../shared/types';

interface ColumnsProps {
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  permissions: ModulePermissions;
}

export function getColumns({ onEdit, onDelete, permissions }: ColumnsProps): ColumnDef<Card>[] {
  const { canUpdate, canDelete } = permissions;
  const hasAnyAction = canUpdate || canDelete;

  const baseColumns: ColumnDef<Card>[] = [
    {
      accessorKey: 'name',
      meta: { title: 'Nombre' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
      cell: ({ row }) => {
        const card = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium">{card.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'cardType',
      meta: { title: 'Tipo' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
      cell: ({ row }) => {
        const cardType = row.original.cardType;
        return (
          <Badge variant={cardType === 'CREDIT' ? 'default' : 'secondary'}>
            {CARD_TYPE_LABELS[cardType]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'brand',
      meta: { title: 'Marca' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Marca" />,
      cell: ({ row }) => row.original.brand || '-',
    },
    {
      accessorKey: 'lastFour',
      meta: { title: 'Número' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
      cell: ({ row }) => {
        const lastFour = row.original.lastFour;
        if (!lastFour) return '-';
        return <span className="font-mono text-sm">•••• {lastFour}</span>;
      },
    },
    {
      accessorKey: 'ownerType',
      meta: { title: 'Titular' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Titular" />,
      cell: ({ row }) => {
        const card = row.original;
        if (card.ownerType === 'PARTNER') {
          return (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{card.partnerName || 'Socio'}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">Empresa</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'isActive',
      meta: { title: 'Estado' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Activa' : 'Inactiva'}
          </Badge>
        );
      },
    },
  ];

  if (hasAnyAction) {
    baseColumns.push({
      id: 'actions',
      cell: ({ row }) => {
        const card = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              {canUpdate && (
                <DropdownMenuItem onClick={() => onEdit(card)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {canUpdate && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem onClick={() => onDelete(card)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });
  }

  return baseColumns;
}
