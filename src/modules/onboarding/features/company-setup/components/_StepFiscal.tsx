'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { TaxStatus } from '@/generated/prisma/enums';

import type { OnboardingInput } from '../schema';
import { _StepHeader } from './_StepHeader';

const TAX_STATUS_OPTIONS: { value: (typeof TaxStatus)[keyof typeof TaxStatus]; label: string }[] = [
  { value: TaxStatus.RESPONSABLE_INSCRIPTO, label: 'Responsable Inscripto' },
  { value: TaxStatus.MONOTRIBUTO, label: 'Monotributo' },
  { value: TaxStatus.EXENTO, label: 'Exento' },
];

interface Props {
  form: UseFormReturn<OnboardingInput>;
}

export function _StepFiscal({ form }: Props) {
  return (
    <div>
      <_StepHeader
        title="Datos fiscales"
        helper="Información fiscal para reportes y documentación. Podés completar esto más tarde si todavía no la tenés."
      />
      <div className="space-y-5">
        <div className="space-y-2 animate-field-in" style={{ animationDelay: '0ms' }}>
          <Label htmlFor="ob-taxId">CUIT / Identificación Fiscal</Label>
          <Input id="ob-taxId" {...form.register('taxId')} placeholder="20-12345678-9" />
        </div>

        <div className="space-y-2 animate-field-in" style={{ animationDelay: '60ms' }}>
          <Label htmlFor="ob-taxStatus">Tipo de contribuyente</Label>
          <Controller
            control={form.control}
            name="taxStatus"
            render={({ field }) => (
              <Select
                onValueChange={(value) =>
                  field.onChange(value ? (value as (typeof TaxStatus)[keyof typeof TaxStatus]) : undefined)
                }
                value={field.value || undefined}
              >
                <SelectTrigger id="ob-taxStatus">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TAX_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </div>
  );
}
