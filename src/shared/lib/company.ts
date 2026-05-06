'use server';

import { logger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentUserId } from '@/shared/lib/current-user';

/**
 * Obtiene SOLO el ID de la company activa (versión ligera)
 * Usar en server actions donde solo necesitas filtrar por companyId
 *
 * @returns string | null - El ID de la company activa o null
 */
export async function getActiveCompanyId() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    // 1. Obtener preferencia guardada (solo el campo necesario)
    const prefs = await prisma.userPreference.findUnique({
      where: { userId },
      select: { activeCompanyId: true },
    });

    // 2. Si hay company guardada, verificar acceso (query mínima)
    if (prefs?.activeCompanyId) {
      const membership = await prisma.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: prefs.activeCompanyId,
            userId,
          },
        },
        select: {
          isActive: true,
          company: { select: { isActive: true } },
        },
      });

      if (membership?.isActive && membership?.company?.isActive) {
        return prefs.activeCompanyId;
      }
    }

    // 3. Buscar primera disponible (query mínima)
    const firstMembership = await prisma.companyMember.findFirst({
      where: {
        userId,
        isActive: true,
        company: { isActive: true },
      },
      select: { companyId: true },
      orderBy: { createdAt: 'asc' },
    });

    if (firstMembership) {
      // Guardar preferencia
      await prisma.userPreference.upsert({
        where: { userId },
        create: { userId, activeCompanyId: firstMembership.companyId },
        update: { activeCompanyId: firstMembership.companyId },
      });
      return firstMembership.companyId;
    }

    return null;
  } catch (error) {
    logger.error('Error al obtener company ID', { data: { error, userId } });
    return null;
  }
}

/**
 * Obtiene la company activa del usuario con todos sus datos
 * Usar SOLO en lugares donde necesitas mostrar información completa (layout, header, etc.)
 *
 * Lógica:
 * 1. Si hay preferencia guardada y aún tiene acceso → usar esa
 * 2. Si no hay guardada o perdió acceso → usar la primera disponible
 * 3. Si no tiene ninguna company → retornar null
 */
export async function getActiveCompany() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    // 1. Obtener preferencia guardada
    const prefs = await prisma.userPreference.findUnique({
      where: { userId },
    });

    // 2. Si hay company guardada, verificar acceso
    if (prefs?.activeCompanyId) {
      const membership = await prisma.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: prefs.activeCompanyId,
            userId,
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
      });

      // Si tiene acceso, retornar esa company
      if (membership?.isActive && membership?.company?.isActive) {
        // Contar cuántas empresas tiene acceso el usuario
        const totalCompanies = await prisma.companyMember.count({
          where: {
            userId,
            isActive: true,
            company: { isActive: true },
          },
        });

        // El modo single solo aplica si tiene acceso a 1 sola empresa Y esa empresa es single
        const effectiveSingleMode =
          membership.company.isSingleCompany && totalCompanies === 1;

        return {
          ...membership.company,
          isOwner: membership.isOwner,
          memberCount: membership.company._count.members,
          isSingleMode: effectiveSingleMode,
        };
      }
    }

    // 3. Si no hay guardada o perdió acceso, buscar la primera disponible
    const firstMembership = await prisma.companyMember.findFirst({
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
        createdAt: 'asc',
      },
    });

    if (firstMembership) {
      // Guardar como nueva preferencia
      await prisma.userPreference.upsert({
        where: { userId },
        create: {
          userId,
          activeCompanyId: firstMembership.companyId,
        },
        update: {
          activeCompanyId: firstMembership.companyId,
        },
      });

      // Contar cuántas empresas tiene acceso el usuario
      const totalCompanies = await prisma.companyMember.count({
        where: {
          userId,
          isActive: true,
          company: { isActive: true },
        },
      });

      // El modo single solo aplica si tiene acceso a 1 sola empresa Y esa empresa es single
      const effectiveSingleMode =
        firstMembership.company.isSingleCompany && totalCompanies === 1;

      return {
        ...firstMembership.company,
        isOwner: firstMembership.isOwner,
        memberCount: firstMembership.company._count.members,
        isSingleMode: effectiveSingleMode,
      };
    }

    // 4. No tiene ninguna company
    return null;
  } catch (error) {
    logger.error('Error al obtener company activa', { data: { error, userId } });
    return null;
  }
}

/**
 * Cambia la company activa del usuario
 */
export async function setActiveCompany(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  try {
    // Verificar que el usuario tiene acceso a la company
    const membership = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
      include: {
        company: {
          select: { isActive: true },
        },
      },
    });

    if (!membership?.isActive || !membership?.company?.isActive) {
      throw new Error('No tienes acceso a esta empresa');
    }

    // Actualizar preferencia
    await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        activeCompanyId: companyId,
      },
      update: {
        activeCompanyId: companyId,
      },
    });

    logger.info('Company activa cambiada', { data: { companyId, userId } });

    return { success: true };
  } catch (error) {
    logger.error('Error al cambiar company activa', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene las preferencias del usuario
 */
export async function getUserPreferences() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    const prefs = await prisma.userPreference.findUnique({
      where: { userId },
    });

    return prefs;
  } catch (error) {
    logger.error('Error al obtener preferencias', { data: { error, userId } });
    return null;
  }
}

// Tipo inferido
export type ActiveCompany = NonNullable<Awaited<ReturnType<typeof getActiveCompany>>>;
