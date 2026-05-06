'use client';

import type { UseFormReturn } from 'react-hook-form';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';

import type { OnboardingInput } from '../schema';
import { _StepHeader } from './_StepHeader';

interface Props {
  form: UseFormReturn<OnboardingInput>;
}

export function _StepIdentity({ form }: Props) {
  const errors = form.formState.errors;
  return (
    <div>
      <_StepHeader
        title="Empecemos por lo esencial"
        helper="Estos datos identifican a tu empresa en todo el sistema. Vas a poder cambiarlos más adelante."
      />
      <div className="space-y-5">
        <div className="space-y-2 animate-field-in" style={{ animationDelay: '0ms' }}>
          <Label htmlFor="ob-name">
            Nombre de la empresa <span className="text-destructive">*</span>
          </Label>
          <Input id="ob-name" autoFocus {...form.register('name')} placeholder="Mi Empresa S.A." />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2 animate-field-in" style={{ animationDelay: '60ms' }}>
          <Label htmlFor="ob-industry">Industria / Rubro</Label>
          <Input
            id="ob-industry"
            {...form.register('industry')}
            placeholder="Ej. Servicios petroleros"
          />
        </div>

        <div className="space-y-2 animate-field-in" style={{ animationDelay: '120ms' }}>
          <Label htmlFor="ob-description">Descripción</Label>
          <Textarea
            id="ob-description"
            rows={3}
            {...form.register('description')}
            placeholder="Una breve descripción de la empresa..."
          />
        </div>
      </div>
    </div>
  );
}
