'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';

export async function bootstrapNewUser(params: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const { userId, firstName, lastName, email } = params;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email;
  const companyName = `${fullName} - Empresa`;

  const pendingInvitation = await prisma.companyInvitation.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (pendingInvitation) {
    logger.info('Sign-up con invitación pendiente, skip bootstrap default', {
      data: { userId, invitationId: pendingInvitation.id },
    });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          isActive: true,
          isSingleCompany: true,
        },
        select: { id: true },
      });

      await tx.companyMember.create({
        data: {
          companyId: company.id,
          userId,
          isOwner: true,
          isActive: true,
          joinedAt: new Date(),
        },
      });

      await tx.userPreference.upsert({
        where: { userId },
        create: { userId, activeCompanyId: company.id },
        update: { activeCompanyId: company.id },
      });
    });

    logger.info('Usuario nuevo bootstrapped', { data: { userId, companyName } });
  } catch (error) {
    logger.error('Error bootstrapping usuario nuevo', { data: { userId, error } });
    throw error;
  }
}
