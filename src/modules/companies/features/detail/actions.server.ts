'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { revalidateCompanyRoutes } from '@/modules/companies/shared/utils';

const ERROR_CODES = {
  NotFound: 'COMPANY_NOT_FOUND',
  Forbidden: 'COMPANY_FORBIDDEN',
} as const;

/**
 * Obtiene una company por ID (solo si el usuario es miembro)
 */
export async function getCompanyById(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  if (!companyId) {
    logger.error('companyId is undefined');
    throw new Error(ERROR_CODES.NotFound);
  }

  try {
    // Verificar que el usuario es miembro
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        isActive: true,
      },
      select: {
        isOwner: true,
      },
    });

    if (!membership) {
      throw new Error(ERROR_CODES.Forbidden);
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        taxId: true,
        taxStatus: true,
        description: true,
        email: true,
        phone: true,
        address: true,
        country: true,
        industry: true,
        logoUrl: true,
        isActive: true,
        isSingleCompany: true,
        createdAt: true,
        updatedAt: true,
        province: true,
        city: true,
        provinceId: true,
        cityId: true,
        _count: {
          select: { members: true },
        },
      },
    });

    if (!company || !company.isActive) {
      throw new Error(ERROR_CODES.NotFound);
    }

    return {
      ...company,
      isOwner: membership.isOwner,
      memberCount: company._count.members,
    };
  } catch (error) {
    logger.error('Error al obtener company', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Elimina una company (soft delete, solo owner)
 */
export async function deleteCompany(companyId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  if (!companyId) {
    logger.error('companyId is undefined');
    throw new Error('Company ID is required');
  }

  try {
    // Verificar que el usuario es owner
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!membership?.isOwner) {
      throw new Error('Solo el propietario puede eliminar la empresa');
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { isActive: false },
    });

    logger.info('Company eliminada', { data: { companyId, userId } });
    revalidateCompanyRoutes(companyId);

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar company', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Actualiza el modo Single Company (solo owner, solo en DEV)
 */
export async function updateCompanySingleMode(companyId: string, isSingleCompany: boolean) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  if (!companyId) {
    logger.error('companyId is undefined');
    throw new Error('Company ID is required');
  }

  // Solo permitir en modo desarrollo
  if (process.env.NEXT_PUBLIC_IS_DEV !== 'true') {
    throw new Error('Esta funcionalidad solo está disponible en modo desarrollo');
  }

  try {
    // Verificar que el usuario es owner
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!membership?.isOwner) {
      throw new Error('Solo el propietario puede cambiar esta configuración');
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { isSingleCompany },
    });

    logger.info('Company single mode actualizado', { data: { companyId, isSingleCompany, userId } });
    revalidateCompanyRoutes(companyId);

    return { success: true };
  } catch (error) {
    logger.error('Error al actualizar single mode', { data: { error, companyId, userId } });
    throw error;
  }
}

// Tipo inferido
export type Company = Awaited<ReturnType<typeof getCompanyById>>;
