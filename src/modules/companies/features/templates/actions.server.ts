'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getCurrentUserId } from '@/shared/lib/current-user';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import { invalidateDocumentTemplateCache, type DocumentTemplateTypeValue } from '@/shared/utils/document-template';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const upsertTemplateSchema = z.object({
  documentType: z.enum([
    'PAYMENT_ORDER',
    'RECEIPT',
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PURCHASE_ORDER',
    'DELIVERY_NOTE',
    'RECEIVING_NOTE',
    'QUOTE',
    'STOCK_TRANSFER',
  ]),
  theme: z.enum(['CLASSIC', 'MODERN', 'MINIMAL']),
  primaryColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Color debe ser hex (#RRGGBB)')
    .optional()
    .or(z.literal('')),
  headerText: z.string().max(500).optional().or(z.literal('')),
  footerText: z.string().max(500).optional().or(z.literal('')),
  notesDefault: z.string().max(1000).optional().or(z.literal('')),
  showCae: z.boolean(),
  showNotes: z.boolean(),
  showWithholdings: z.boolean(),
  showIssuer: z.boolean(),
  showReceiver: z.boolean(),
});

/**
 * Carga todas las configs de template para la empresa activa (crea las que falten con defaults).
 */
export async function getCompanyTemplates(companyId: string) {
  await checkPermission('company.documents', 'view', { redirect: true });

  const configs = await prisma.documentTemplate.findMany({
    where: { companyId },
  });

  const allTypes = [
    'PAYMENT_ORDER',
    'RECEIPT',
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'PURCHASE_ORDER',
    'DELIVERY_NOTE',
    'RECEIVING_NOTE',
    'QUOTE',
    'STOCK_TRANSFER',
  ] as const;

  return allTypes.map((type) => {
    const existing = configs.find((c: { documentType: string }) => c.documentType === type);
    return (
      existing ?? {
        id: null,
        companyId,
        documentType: type,
        theme: 'CLASSIC',
        primaryColor: null,
        headerText: null,
        footerText: null,
        notesDefault: null,
        showCae: true,
        showNotes: true,
        showWithholdings: true,
        showIssuer: true,
        showReceiver: true,
        isActive: true,
        createdAt: null,
        updatedAt: null,
      }
    );
  });
}

/**
 * Crea o actualiza la config de un template.
 */
export async function upsertDocumentTemplate(
  input: z.infer<typeof upsertTemplateSchema>
) {
  await checkPermission('company.documents', 'update', { redirect: true });

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  const parsed = upsertTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const data = {
    companyId,
    documentType: parsed.data.documentType,
    theme: parsed.data.theme,
    primaryColor: parsed.data.primaryColor || null,
    headerText: parsed.data.headerText || null,
    footerText: parsed.data.footerText || null,
    notesDefault: parsed.data.notesDefault || null,
    showCae: parsed.data.showCae,
    showNotes: parsed.data.showNotes,
    showWithholdings: parsed.data.showWithholdings,
    showIssuer: parsed.data.showIssuer,
    showReceiver: parsed.data.showReceiver,
    isActive: true,
  };

  try {
    await prisma.documentTemplate.upsert({
      where: {
        companyId_documentType: {
          companyId,
          documentType: parsed.data.documentType,
        },
      },
      create: data,
      update: data,
    });

    invalidateDocumentTemplateCache(companyId, parsed.data.documentType);

    revalidatePath('/dashboard/company/documents/templates');
    revalidatePath(`/dashboard/company/documents/templates/${parsed.data.documentType.toLowerCase().replace(/_/g, '-')}`);

    logger.info('Template actualizado', {
      data: { companyId, documentType: parsed.data.documentType },
    });

    return { success: true };
  } catch (error) {
    logger.error('Error al actualizar template', {
      data: { error, companyId, documentType: parsed.data.documentType },
    });
    throw new Error('Error al guardar la configuración del template');
  }
}

/**
 * Resetea un template a defaults (elimina la config → vuelve a CLASSIC).
 */
export async function resetDocumentTemplate(documentType: string) {
  await checkPermission('company.documents', 'update', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    await prisma.documentTemplate.deleteMany({
      where: { companyId, documentType: documentType as DocumentTemplateTypeValue },
    });

    invalidateDocumentTemplateCache(companyId, documentType);

    revalidatePath('/dashboard/company/documents/templates');

    return { success: true };
  } catch (error) {
    logger.error('Error al resetear template', {
      data: { error, companyId, documentType },
    });
    throw new Error('Error al resetear el template');
  }
}