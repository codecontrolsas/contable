import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import type { DocumentTemplateType } from '@/generated/prisma/enums';
import { resolveThemeConfig, type ThemeConfig, type ThemeName } from './pdf-themes';

/**
 * Configuración completa (template config + theme) que consume un PDF generator.
 */
export interface DocumentTemplateConfig {
  themeConfig: ThemeConfig;
  headerText: string | null;
  footerText: string | null;
  notesDefault: string | null;
  showCae: boolean;
  showNotes: boolean;
  showWithholdings: boolean;
  showIssuer: boolean;
  showReceiver: boolean;
}

/**
 * Defaults globales: tema CLASSIC, todo visible, sin textos custom.
 */
export function getDefaultTemplateConfig(): DocumentTemplateConfig {
  return {
    themeConfig: resolveThemeConfig('CLASSIC'),
    headerText: null,
    footerText: null,
    notesDefault: null,
    showCae: true,
    showNotes: true,
    showWithholdings: true,
    showIssuer: true,
    showReceiver: true,
  };
}

/**
 * Carga la config de template para (companyId, documentType). Si no existe
 * ninguna config personalizada, devuelve los defaults (CLASSIC).
 *
 * Cache en memoria con TTL de 60s.
 */
const cache = new Map<string, { config: DocumentTemplateConfig; expires: number }>();
const CACHE_TTL_MS = 60_000;

export async function getDocumentTemplateConfig(
  companyId: string,
  documentType: string
): Promise<DocumentTemplateConfig> {
  const cacheKey = `${companyId}:${documentType}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.config;
  }

  try {
    const dbConfig = await prisma.documentTemplate.findUnique({
      where: {
        companyId_documentType: { companyId, documentType: documentType as DocumentTemplateType },
      },
    });

    let config: DocumentTemplateConfig;
    if (dbConfig && dbConfig.isActive) {
      config = {
        themeConfig: resolveThemeConfig(dbConfig.theme as ThemeName, dbConfig.primaryColor),
        headerText: dbConfig.headerText,
        footerText: dbConfig.footerText,
        notesDefault: dbConfig.notesDefault,
        showCae: dbConfig.showCae,
        showNotes: dbConfig.showNotes,
        showWithholdings: dbConfig.showWithholdings,
        showIssuer: dbConfig.showIssuer,
        showReceiver: dbConfig.showReceiver,
      };
    } else {
      config = getDefaultTemplateConfig();
    }

    cache.set(cacheKey, { config, expires: Date.now() + CACHE_TTL_MS });
    return config;
  } catch (error) {
    logger.error('Error al obtener config de template', {
      data: { companyId, documentType, error },
    });
    return getDefaultTemplateConfig();
  }
}

/**
 * Invalida la cache para un template específico.
 */
export function invalidateDocumentTemplateCache(
  companyId: string,
  documentType: string
): void {
  cache.delete(`${companyId}:${documentType}`);
}

/**
 * Lista todos los tipos de documentos que tienen template configurable.
 */
export const DOCUMENT_TEMPLATE_TYPES = [
  { value: 'PAYMENT_ORDER', label: 'Orden de Pago' },
  { value: 'RECEIPT', label: 'Recibo de Cobro' },
  { value: 'SALES_INVOICE', label: 'Factura de Venta' },
  { value: 'PURCHASE_INVOICE', label: 'Factura de Compra' },
  { value: 'PURCHASE_ORDER', label: 'Orden de Compra' },
  { value: 'DELIVERY_NOTE', label: 'Remito de Entrega' },
  { value: 'RECEIVING_NOTE', label: 'Remito de Recepción' },
  { value: 'QUOTE', label: 'Presupuesto' },
  { value: 'STOCK_TRANSFER', label: 'Transferencia entre Almacenes' },
] as const;

export type DocumentTemplateTypeValue = (typeof DOCUMENT_TEMPLATE_TYPES)[number]['value'];