'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { _PartnerForm } from './_PartnerForm';
import { createPartner } from '../../list/actions.server';
import type { PartnerFormData } from '../../../shared/validators';
import { logger } from '@/shared/lib/logger';

export function _CreatePartnerForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: PartnerFormData) => {
    setIsSubmitting(true);
    try {
      await createPartner(data);
      toast.success('Socio creado correctamente');
      router.push('/dashboard/commercial/treasury/partners');
      router.refresh();
    } catch (error) {
      logger.error('Error al crear socio', { data: { error } });
      toast.error(error instanceof Error ? error.message : 'Error al crear socio');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <_PartnerForm
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Crear Socio"
    />
  );
}
