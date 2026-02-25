import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getPriceListById } from '../list/actions.server';
import { _EditPriceListForm } from './components/_EditPriceListForm';
import { notFound } from 'next/navigation';

interface EditPriceListProps {
  priceListId: string;
}

export async function EditPriceList({ priceListId }: EditPriceListProps) {
  const priceList = await getPriceListById(priceListId);

  if (!priceList) {
    notFound();
  }

  return (
    <PermissionGuard module="commercial.price-lists" action="update" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editar Lista de Precios</h1>
          <p className="text-sm text-muted-foreground">
            Modifica la información de: {priceList.name}
          </p>
        </div>

        <_EditPriceListForm priceList={priceList} />
      </div>
    </PermissionGuard>
  );
}
