'use client';

import { useQuery } from '@tanstack/react-query';
import { Layers, Package, TrendingDown } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { getEquivalenceById } from '../actions.server';

interface EquivalenceDetailModalProps {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function _EquivalenceDetailModal({
  groupId,
  open,
  onOpenChange,
}: EquivalenceDetailModalProps) {
  const { data: group, isLoading } = useQuery({
    queryKey: ['equivalence-detail', groupId],
    queryFn: () => getEquivalenceById(groupId!),
    enabled: !!groupId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {isLoading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              group?.name ?? 'Grupo de Equivalencia'
            )}
          </DialogTitle>
          <DialogDescription>
            {group?.oemCode && (
              <span className="font-mono">OEM: {group.oemCode}</span>
            )}
            {group?.notes && (
              <span className="block mt-1">{group.notes}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : group ? (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{group.products.length}</p>
                <p className="text-xs text-muted-foreground">Productos</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{group.totalStock}</p>
                <p className="text-xs text-muted-foreground">Stock Total</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {group.bestPrice != null ? `$${group.bestPrice.toFixed(2)}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Mejor Precio</p>
              </div>
            </div>

            {/* Tabla de productos */}
            {group.products.length > 0 ? (
              <div className="max-h-[400px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.products.map((product) => {
                      const isBestPrice =
                        group.bestPrice != null &&
                        product.salePrice === group.bestPrice &&
                        product.status === 'ACTIVE';

                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-sm">
                            <Link
                              href={`/dashboard/commercial/products/${product.id}`}
                              className="hover:underline"
                            >
                              {product.code}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{product.name}</span>
                              {product.oemCode && (
                                <p className="text-xs text-muted-foreground">
                                  OEM: {product.oemCode}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {product.brand || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                isBestPrice
                                  ? 'font-semibold text-green-600'
                                  : ''
                              }
                            >
                              ${product.salePrice.toFixed(2)}
                              {isBestPrice && (
                                <TrendingDown className="inline ml-1 h-3 w-3" />
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {product.currentStock}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                product.status === 'ACTIVE'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {product.status === 'ACTIVE'
                                ? 'Activo'
                                : product.status === 'INACTIVE'
                                  ? 'Inactivo'
                                  : 'Discontinuado'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Package className="h-8 w-8" />
                <p className="text-sm">No hay productos en este grupo</p>
                <p className="text-xs">
                  Asigná productos desde la edición de cada producto
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">
            Grupo no encontrado
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
