'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { _CardForm } from './_CardForm';
import { createCard } from '../../list/actions.server';
import type { CardFormData } from '../../../shared/validators';
import { logger } from '@/shared/lib/logger';

export function _CreateCardForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CardFormData) => {
    setIsSubmitting(true);
    try {
      await createCard(data);
      toast.success('Tarjeta creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.push('/dashboard/commercial/treasury/cards');
      router.refresh();
    } catch (error) {
      logger.error('Error al crear tarjeta', { data: { error } });
      toast.error(error instanceof Error ? error.message : 'Error al crear tarjeta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <_CardForm onSubmit={handleSubmit} isSubmitting={isSubmitting} submitLabel="Crear Tarjeta" />
  );
}
