'use server';

import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';

// ============================================
// MUTATIONS
// ============================================

/**
 * Marca un documento de equipo como vencido (para uso en jobs/cron)
 */
export async function markEquipmentDocumentAsExpired(id: string) {
  await checkPermission('documents', 'update', { redirect: true });
  try {
    await prisma.equipmentDocument.update({
      where: { id },
      data: { state: 'EXPIRED' },
    });

    logger.info('Equipment document marked as expired', { data: { id } });
    return { success: true };
  } catch (error) {
    logger.error('Error marking equipment document as expired', {
      data: { error, id },
    });
    throw error;
  }
}
