import { notFound } from 'next/navigation';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getCard } from '../list/actions.server';
import { _EditCardForm } from './components/_EditCardForm';

interface EditCardProps {
  cardId: string;
}

export async function EditCard({ cardId }: EditCardProps) {
  const card = await getCard(cardId);

  if (!card) {
    notFound();
  }

  return (
    <PermissionGuard module="commercial.treasury.cards" action="update" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editar Tarjeta</h1>
          <p className="text-sm text-muted-foreground">
            Modifica la información de la tarjeta: {card.name}
          </p>
        </div>

        <_EditCardForm card={card} />
      </div>
    </PermissionGuard>
  );
}
