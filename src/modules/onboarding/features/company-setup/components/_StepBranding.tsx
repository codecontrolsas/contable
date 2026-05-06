'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Camera } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/shared/components/ui/button';

import type { OnboardingInput } from '../schema';
import { _StepHeader } from './_StepHeader';

interface Props {
  form: UseFormReturn<OnboardingInput>;
  logoUrl: string | null;
  onPendingFileChange: (file: File | null) => void;
}

/**
 * Branding step.
 *
 * En contable todavía no existe `uploadCompanyLogo` server action — por eso
 * este step solo permite previsualizar el logo localmente. El logo no se sube
 * durante el onboarding; el usuario podrá subirlo más tarde desde
 * Configuración > Empresa.
 *
 * Mantenemos el File en el state del padre por si más adelante implementamos
 * el upload directo durante el wizard.
 */
export function _StepBranding({ form, logoUrl, onPendingFileChange }: Props) {
  const values = form.getValues();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onPendingFileChange(file);
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const previewUrl = pendingPreviewUrl ?? logoUrl;
  const subtitle =
    [values.industry, values.country].filter(Boolean).join(' · ') || 'Lista para empezar';

  return (
    <div>
      <_StepHeader
        title="Branding"
        helper="Subí el logo de tu empresa. Aparecerá en el sidebar, exportaciones y reportes."
      />
      <div className="space-y-6">
        <div
          className="flex flex-col items-center gap-3 animate-field-in"
          style={{ animationDelay: '0ms' }}
        >
          <div className="relative h-32 w-32 overflow-hidden rounded-xl border-2 border-muted bg-muted flex items-center justify-center">
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt="Logo de empresa"
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" />
            {previewUrl ? 'Cambiar' : 'Subir logo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="text-center text-xs text-muted-foreground max-w-xs">
            JPG, PNG o WebP. El logo se podrá subir después desde Configuración &gt; Empresa.
          </p>
        </div>

        <div
          className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-muted/40 to-background p-6 animate-field-in min-w-0"
          style={{ animationDelay: '120ms' }}
        >
          <div className="flex items-center justify-between mb-5 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Vista previa
            </p>
            <div className="h-px flex-1 ml-4 bg-foreground/10" />
          </div>

          <div className="flex items-start gap-5 min-w-0">
            <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-background border shadow-sm flex items-center justify-center">
              {previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={previewUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground/60" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p
                className="text-xl leading-tight tracking-tight break-words"
                style={{ fontFamily: 'var(--font-display), serif', fontWeight: 500 }}
              >
                {values.name || 'Tu empresa'}
              </p>
              <p className="text-sm text-muted-foreground break-words">{subtitle}</p>
              {values.description && (
                <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 pt-1 break-words">
                  {values.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
