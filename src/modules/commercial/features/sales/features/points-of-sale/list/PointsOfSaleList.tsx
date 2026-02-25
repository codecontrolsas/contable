import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getPointsOfSale } from './actions.server';
import { PointsOfSaleTable } from './components/_PointsOfSaleTable';

export async function PointsOfSaleList() {
  const pointsOfSale = await getPointsOfSale();

  return (
    <PermissionGuard module="commercial.points-of-sale" action="view" redirect>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Puntos de Venta</h2>
            <p className="text-muted-foreground">
              Gestiona los puntos de venta para la facturación electrónica
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/commercial/points-of-sale/new">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Punto de Venta
            </Link>
          </Button>
        </div>

        <PointsOfSaleTable data={pointsOfSale} />
      </div>
    </PermissionGuard>
  );
}
