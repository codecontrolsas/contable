'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Download, Upload, Loader2, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';

import {
  importOpeningSalesInvoicesFromExcel,
  importOpeningPurchaseInvoicesFromExcel,
} from '../actions.server';
import {
  generateSalesInvoicesTemplate,
  generatePurchaseInvoicesTemplate,
} from '../lib/invoices-excel-template';

interface Props {
  type: 'sales' | 'purchases';
  onImported: () => void;
}

export function _InvoiceImportDialog({ type, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const buffer =
        type === 'sales'
          ? await generateSalesInvoicesTemplate()
          : await generatePurchaseInvoicesTemplate();

      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plantilla-facturas-${type === 'sales' ? 'venta' : 'compra'}-apertura.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al generar la plantilla');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      // Convertir a base64
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      const importResult =
        type === 'sales'
          ? await importOpeningSalesInvoicesFromExcel(base64)
          : await importOpeningPurchaseInvoicesFromExcel(base64);

      setResult({
        imported: importResult.imported,
        errors: importResult.errors,
      });

      if (importResult.imported > 0) {
        toast.success(
          `${importResult.imported} factura(s) importada(s) correctamente`
        );
        onImported();
      }

      if (importResult.errors.length > 0) {
        toast.warning(
          `${importResult.errors.length} error(es) durante la importación`
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="mr-1 h-4 w-4" />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Importar Facturas de {type === 'sales' ? 'Venta' : 'Compra'}
          </DialogTitle>
          <DialogDescription>
            Descargá la plantilla, completala con los datos de las facturas
            pendientes y subila.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Paso 1: Descargar plantilla */}
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              1
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              Descargar Plantilla
            </Button>
          </div>

          {/* Paso 2: Subir archivo */}
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              2
            </span>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                {isUploading ? 'Importando...' : 'Subir Archivo'}
              </Button>
            </div>
          </div>

          {/* Resultado */}
          {result && (
            <div className="space-y-2">
              {result.imported > 0 && (
                <Alert>
                  <AlertTitle>Importación exitosa</AlertTitle>
                  <AlertDescription>
                    {result.imported} factura(s) importada(s) correctamente.
                  </AlertDescription>
                </Alert>
              )}

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>
                    Errores ({result.errors.length})
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 list-inside list-disc text-sm max-h-40 overflow-auto">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
