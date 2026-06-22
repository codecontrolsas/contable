'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { _CardForm } from '../../create/components/_CardForm';
import { updateCard } from '../../list/actions.server';
import type { Card } from '../../../shared/types';
import type { CardFormData } from '../../../shared/validators';
import { logger } from '@/shared/lib/logger';

interface EditCardFormProps {
  card: Card;
}

export function _EditCardForm({ card }: EditCardFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CardFormData) => {
    setIsSubmitting(true);
    try {
      await updateCard(card.id, data);
      toast.success('Tarjeta actualizada correctamente');
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.push('/dashboard/commercial/treasury/cards');
      router.refresh();
    } catch (error) {
      logger.error('Error al actualizar tarjeta', { data: { error } });
      toast.error(error instanceof Error ? error.message : 'Error al actualizar tarjeta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultValues: CardFormData = {
    name: card.name,
    cardType: card.cardType,
    brand: card.brand || '',
    lastFour: card.lastFour || '',
    ownerType: card.ownerType,
    partnerId: card.partnerId || '',
    creditLimit: card.creditLimit ?? undefined,
    closingDay: card.closingDay ?? undefined,
    dueDay: card.dueDay ?? undefined,
    isActive: card.isActive,
  };

  return (
    <_CardForm
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Guardar Cambios"
    />
  );
}
