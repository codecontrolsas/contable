'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';

/**
 * Obtiene todas las companies donde el usuario es miembro activo
 */
export async function getMyCompanies() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  try {
    const memberships = await prisma.companyMember.findMany({
      where: {
        userId,
        isActive: true,
        company: {
          isActive: true,
        },
      },
      include: {
        company: {
          include: {
            province: true,
            city: true,
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: {
        company: {
          name: 'asc',
        },
      },
    });

    return memberships.map((m) => ({
      ...m.company,
      isOwner: m.isOwner,
      memberCount: m.company._count.members,
    }));
  } catch (error) {
    logger.error('Error al obtener companies del usuario', { data: { error, userId } });
    throw new Error('Error al obtener empresas');
  }
}

// Tipo inferido
export type CompanyListItem = Awaited<ReturnType<typeof getMyCompanies>>[number];
