'use client';

import { useEffect } from 'react';
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
import { useProvinces, useCitiesByProvince } from '@/shared/hooks/useGeography';

import type { OnboardingInput } from '../schema';
import { _StepHeader } from './_StepHeader';

interface Props {
  form: UseFormReturn<OnboardingInput>;
}

export function _StepContact({ form }: Props) {
  const errors = form.formState.errors;
  const { data: provinces = [], isLoading: isLoadingProvinces } = useProvinces();
  const provinceId = form.watch('provinceId');
  const { data: cities = [], isLoading: isLoadingCities } = useCitiesByProvince(
    typeof provinceId === 'number' ? provinceId : null,
  );

  useEffect(() => {
    if (!provinceId) {
      form.setValue('cityId', undefined);
    }
  }, [provinceId, form]);

  return (
    <div>
      <_StepHeader
        title="Contacto y ubicación"
        helper="¿Dónde está tu empresa? Esta información aparece en documentos exportados."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 animate-field-in" style={{ animationDelay: '0ms' }}>
          <Label htmlFor="ob-email">Email de contacto</Label>
          <Input
            id="ob-email"
            type="email"
            {...form.register('email')}
            placeholder="contacto@miempresa.com"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2 animate-field-in" style={{ animationDelay: '60ms' }}>
          <Label htmlFor="ob-phone">Teléfono</Label>
          <Input id="ob-phone" {...form.register('phone')} placeholder="+54 11 1234 5678" />
        </div>

        <div className="space-y-2 animate-field-in" style={{ animationDelay: '120ms' }}>
          <Label htmlFor="ob-country">País</Label>
          <Input id="ob-country" {...form.register('country')} />
        </div>

        <div className="space-y-2 animate-field-in" style={{ animationDelay: '180ms' }}>
          <Label htmlFor="ob-province">Provincia</Label>
          <Controller
            control={form.control}
            name="provinceId"
            render={({ field }) => (
              <Select
                onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
                value={field.value ? String(field.value) : undefined}
                disabled={isLoadingProvinces}
              >
                <SelectTrigger id="ob-province">
                  <SelectValue
                    placeholder={isLoadingProvinces ? 'Cargando...' : 'Seleccionar provincia'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2 animate-field-in" style={{ animationDelay: '240ms' }}>
          <Label htmlFor="ob-city">Ciudad</Label>
          <Controller
            control={form.control}
            name="cityId"
            render={({ field }) => (
              <Select
                onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
                value={field.value ? String(field.value) : undefined}
                disabled={!provinceId || isLoadingCities || cities.length === 0}
              >
                <SelectTrigger id="ob-city">
                  <SelectValue
                    placeholder={
                      !provinceId
                        ? 'Selecciona una provincia'
                        : isLoadingCities
                          ? 'Cargando...'
                          : cities.length === 0
                            ? 'No hay ciudades'
                            : 'Seleccionar ciudad'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div
          className="space-y-2 md:col-span-2 animate-field-in"
          style={{ animationDelay: '300ms' }}
        >
          <Label htmlFor="ob-address">Dirección</Label>
          <Input id="ob-address" {...form.register('address')} placeholder="Calle, número..." />
        </div>
      </div>
    </div>
  );
}
