'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { uploadFile, deleteFile, getPresignedDownloadUrl } from '@/shared/lib/storage';
import { slugify, sanitizeFilename } from '@/shared/config/storage.config';
import { revalidatePath } from 'next/cache';

/**
 * Sube un archivo adjunto a un gasto
 */
export async function uploadExpenseAttachment(params: {
  expenseId: string;
  companyName: string;
  expenseNumber: string;
  fileName: string;
  file: number[];
}) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  const { expenseId, companyName, expenseNumber, fileName, file } = params;

  try {
    // Verificar que el gasto pertenece a la empresa
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, companyId },
      select: { id: true },
    });

    if (!expense) throw new Error('Gasto no encontrado');

    const buffer = Buffer.from(file);

    // Construir path de storage
    const companySlug = slugify(companyName);
    const numberSlug = slugify(expenseNumber);
    const folder = `${companySlug}/comercial/gastos/${numberSlug}`;

    // Subir archivo
    const result = await uploadFile(buffer, fileName, { folder });

    // Crear registro de adjunto
    const attachment = await prisma.expenseAttachment.create({
      data: {
        expenseId,
        fileName,
        fileKey: result.key,
        fileSize: buffer.length,
        mimeType: null,
      },
    });

    logger.info('Adjunto de gasto subido', {
      data: { expenseId, attachmentId: attachment.id, key: result.key },
    });

    revalidatePath('/dashboard/commercial/expenses');

    return { success: true, data: attachment };
  } catch (error) {
    logger.error('Error al subir adjunto de gasto', { data: { error, expenseId } });
    if (error instanceof Error) throw error;
    throw new Error('Error al subir adjunto');
  }
}

/**
 * Elimina un archivo adjunto de un gasto
 */
export async function deleteExpenseAttachment(attachmentId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Obtener el adjunto y verificar pertenencia
    const attachment = await prisma.expenseAttachment.findFirst({
      where: {
        id: attachmentId,
        expense: { companyId },
      },
      select: { id: true, fileKey: true },
    });

    if (!attachment) throw new Error('Adjunto no encontrado');

    // Eliminar de storage
    try {
      await deleteFile(attachment.fileKey);
    } catch (error) {
      logger.warn('No se pudo eliminar archivo de storage', { data: { key: attachment.fileKey, error } });
    }

    // Eliminar registro
    await prisma.expenseAttachment.delete({ where: { id: attachmentId } });

    logger.info('Adjunto de gasto eliminado', { data: { attachmentId } });
    revalidatePath('/dashboard/commercial/expenses');

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar adjunto de gasto', { data: { error, attachmentId } });
    if (error instanceof Error) throw error;
    throw new Error('Error al eliminar adjunto');
  }
}

/**
 * Obtiene la URL de descarga de un adjunto de gasto
 */
export async function getExpenseAttachmentUrl(attachmentId: string) {
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  const attachment = await prisma.expenseAttachment.findFirst({
    where: {
      id: attachmentId,
      expense: { companyId },
    },
    select: { fileKey: true },
  });

  if (!attachment) return null;

  return getPresignedDownloadUrl(attachment.fileKey);
}
