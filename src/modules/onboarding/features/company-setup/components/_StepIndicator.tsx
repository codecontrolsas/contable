'use client';

import { cn } from '@/shared/lib/utils';

const STEP_LABELS = ['Identidad', 'Datos fiscales', 'Contacto y ubicación', 'Branding'];

interface Props {
  step: 1 | 2 | 3 | 4;
}

export function _StepIndicator({ step }: Props) {
  return (
    <div className="flex h-full flex-col justify-between p-10">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Paso</p>
        <p
          key={step}
          className={cn(
            'font-display text-[10rem] leading-none tracking-tight tabular-nums',
            'animate-fade-in-up',
          )}
          style={{ fontFamily: 'var(--font-display), serif' }}
        >
          {String(step).padStart(2, '0')}
        </p>
      </div>
      <div className="space-y-3">
        <div className="h-px w-10 bg-foreground/30" />
        <p
          className="font-display text-2xl tracking-tight"
          style={{ fontFamily: 'var(--font-display), serif' }}
          key={`label-${step}`}
        >
          {STEP_LABELS[step - 1]}
        </p>
        <p className="text-xs text-muted-foreground max-w-[14rem]">
          de 04 — configurá tu empresa una vez y comenzá a usar el sistema
        </p>
      </div>
    </div>
  );
}
