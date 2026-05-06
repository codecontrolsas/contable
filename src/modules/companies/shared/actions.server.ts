'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';

/**
 * Verifica si el usuario tiene acceso a una company
 */
export async function userHasAccessToCompany(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  try {
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
      },
      include: {
        company: {
          select: { isActive: true },
        },
      },
    });

    return membership?.isActive && membership?.company?.isActive;
  } catch {
    return false;
  }
}
