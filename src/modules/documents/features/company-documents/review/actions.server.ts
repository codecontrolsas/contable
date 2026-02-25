'use server';

import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';

// ============================================
// MUTATIONS
// ============================================

/**
 * Marca un documento de empresa como vencido (para uso en jobs/cron)
 */
export async function markCompanyDocumentAsExpired(id: string) {
  await checkPermission('company.documents', 'update', { redirect: true });
  try {
    await prisma.companyDocument.update({
      where: { id },
      data: { state: 'EXPIRED' },
    });

    logger.info('Company document marked as expired', { data: { id } });
    return { success: true };
  } catch (error) {
    logger.error('Error marking company document as expired', {
      data: { error, id },
    });
    throw error;
  }
}
