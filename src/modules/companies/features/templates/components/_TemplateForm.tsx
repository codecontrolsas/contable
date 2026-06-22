'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { THEME_LABELS, THEME_DESCRIPTIONS, THEME_PRESETS, type ThemeName } from '@/shared/utils/pdf-themes';
import { resetDocumentTemplate, upsertDocumentTemplate } from '../actions.server';
import type { DocumentTemplateTypeValue } from '@/shared/utils/document-template';

interface Defaults {
  theme: string;
  primaryColor: string | null;
  headerText: string | null;
  footerText: string | null;
  notesDefault: string | null;
  showCae: boolean;
  showNotes: boolean;
  showWithholdings: boolean;
  showIssuer: boolean;
  showReceiver: boolean;
  isCustomized: boolean;
}

interface Props {
  documentType: DocumentTemplateTypeValue;
  label: string;
  defaults: Defaults;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function _TemplateForm({ documentType, label, defaults }: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const form = useForm<{
    theme: ThemeName;
    primaryColor: string;
    headerText: string;
    footerText: string;
    notesDefault: string;
    showCae: boolean;
    showNotes: boolean;
    showWithholdings: boolean;
    showIssuer: boolean;
    showReceiver: boolean;
  }>({
    defaultValues: {
      theme: (defaults.theme as ThemeName) ?? 'CLASSIC',
      primaryColor: defaults.primaryColor ?? '',
      headerText: defaults.headerText ?? '',
      footerText: defaults.footerText ?? '',
      notesDefault: defaults.notesDefault ?? '',
      showCae: defaults.showCae,
      showNotes: defaults.showNotes,
      showWithholdings: defaults.showWithholdings,
      showIssuer: defaults.showIssuer,
      showReceiver: defaults.showReceiver,
    },
  });

  const watchTheme = form.watch('theme');
  const watchColor = form.watch('primaryColor');
  const accentColor =
    HEX_COLOR_REGEX.test(watchColor) ? watchColor : THEME_PRESETS[watchTheme].primaryColor;

  const handleSubmit = async (data: {
    theme: ThemeName;
    primaryColor: string;
    headerText: string;
    footerText: string;
    notesDefault: string;
    showCae: boolean;
    showNotes: boolean;
    showWithholdings: boolean;
    showIssuer: boolean;
    showReceiver: boolean;
  }) => {
    setIsSaving(true);
    try {
      await upsertDocumentTemplate({
        documentType,
        theme: data.theme,
        primaryColor: data.primaryColor,
        headerText: data.headerText,
        footerText: data.footerText,
        notesDefault: data.notesDefault,
        showCae: data.showCae,
        showNotes: data.showNotes,
        showWithholdings: data.showWithholdings,
        showIssuer: data.showIssuer,
        showReceiver: data.showReceiver,
      });
      toast.success('Plantilla guardada');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetDocumentTemplate(documentType);
      form.reset({
        theme: 'CLASSIC',
        primaryColor: '',
        headerText: '',
        footerText: '',
        notesDefault: '',
        showCae: true,
        showNotes: true,
        showWithholdings: true,
        showIssuer: true,
        showReceiver: true,
      });
      toast.success('Plantilla restablecida a defaults');
      setShowResetConfirm(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al resetear');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/company/documents/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{label}</h1>
            <p className="text-sm text-muted-foreground">
              {documentType.replace(/_/g, ' ')} ·{' '}
              {defaults.isCustomized ? (
                <span className="text-primary">Personalizado</span>
              ) : (
                <span>Usando defaults</span>
              )}
            </p>
          </div>
        </div>
        {defaults.isCustomized && (
          <Button variant="outline" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restablecer
          </Button>
        )}
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4 lg:grid-cols-3">
        {/* Columna izquierda: configuración */}
        <div className="space-y-4 lg:col-span-2">
          {/* Tema */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tema</CardTitle>
              <CardDescription>Elegí un estilo visual para este documento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {(['CLASSIC', 'MODERN', 'MINIMAL'] as ThemeName[]).map((theme) => {
                  const preset = THEME_PRESETS[theme];
                  const isSelected = watchTheme === theme;
                  return (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => form.setValue('theme', theme)}
                      className={`rounded-md border p-3 text-left transition-colors ${
                        isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: preset.primaryColor }}
                        />
                        <span className="text-sm font-medium">{THEME_LABELS[theme]}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {THEME_DESCRIPTIONS[theme]}
                      </p>
                      <div
                        className="mt-2 rounded-sm border p-1 text-[9px]"
                        style={{
                          backgroundColor: preset.headerBg,
                          color: preset.headerTextColor,
                          borderColor: preset.borderColor,
                        }}
                      >
                        Header preview
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Color personalizado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Color de Acento</CardTitle>
              <CardDescription>
                Opcional: override del color principal del tema (formato hex #RRGGBB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder="#1e40af"
                  className="max-w-[200px] font-mono"
                  {...form.register('primaryColor')}
                />
                <div
                  className="h-9 w-9 rounded-md border"
                  style={{ backgroundColor: accentColor }}
                />
                {form.watch('primaryColor') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setValue('primaryColor', '')}
                  >
                    Usar color del tema
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Textos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Textos Personalizados</CardTitle>
              <CardDescription>Aparecen en el PDF. Si están vacíos, no se muestran.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headerText">Texto adicional del header</Label>
                <Textarea
                  id="headerText"
                  rows={2}
                  placeholder="Ej: Distribuidor autorizado - Sucursal Centro"
                  {...form.register('headerText')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="footerText">Pie de página</Label>
                <Textarea
                  id="footerText"
                  rows={2}
                  placeholder="Ej: www.empresa.com.ar · info@empresa.com.ar"
                  {...form.register('footerText')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notesDefault">Observaciones predeterminadas</Label>
                <Textarea
                  id="notesDefault"
                  rows={2}
                  placeholder="Texto que se sugiere por defecto en el campo de observaciones"
                  {...form.register('notesDefault')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Secciones Visibles</CardTitle>
              <CardDescription>
                Mostrar u ocultar bloques en el PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  { key: 'showIssuer', label: 'Datos del emisor (header)' },
                  { key: 'showReceiver', label: 'Datos del receptor (cliente/proveedor)' },
                  { key: 'showCae', label: 'CAE (código AFIP)' },
                  { key: 'showNotes', label: 'Observaciones' },
                  { key: 'showWithholdings', label: 'Retenciones' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                  </div>
                  <Switch
                    checked={form.watch(key)}
                    onCheckedChange={(checked) => form.setValue(key, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>

        {/* Columna derecha: preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>
                Así se verá el header del documento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-md border p-4 text-xs"
                style={{
                  backgroundColor:
                    watchTheme === 'MODERN' ? '#f1f5f9' : '#ffffff',
                  borderColor: accentColor,
                  borderWidth: watchTheme === 'CLASSIC' ? 2 : 1,
                  color: '#0f172a',
                }}
              >
                <div
                  className="text-center font-bold uppercase"
                  style={{ color: accentColor }}
                >
                  {label.toUpperCase()}
                </div>
                <div className="mt-1 text-center text-[10px]">
                  N° XX-00001
                </div>
                <div className="mt-3 space-y-0.5 text-center text-[10px] text-muted-foreground">
                  <p>Empresa SA</p>
                  <p>CUIT: 30-12345678-9</p>
                  <p>Av. Siempre Viva 123</p>
                </div>
                {form.watch('headerText') && (
                  <div
                    className="mt-3 rounded-sm p-2 text-center text-[10px] italic"
                    style={{ backgroundColor: '#f8fafc' }}
                  >
                    {form.watch('headerText')}
                  </div>
                )}
                <div
                  className="mt-3 border-t pt-2"
                  style={{ borderColor: accentColor, opacity: 0.4 }}
                />
                <div className="mt-2 space-y-1">
                  <div
                    className="text-[10px] font-semibold"
                    style={{ color: accentColor }}
                  >
                    DETALLE
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Item 1 · Item 2 · Item 3
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-muted-foreground">
                <p>
                  <span className="font-semibold">Tema:</span> {THEME_LABELS[watchTheme]}
                </p>
                <p>
                  <span className="font-semibold">Color:</span>{' '}
                  <span className="font-mono">{accentColor}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer plantilla</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar la configuración personalizada y volver a los defaults (tema Clásico)?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? 'Restableciendo...' : 'Restablecer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}