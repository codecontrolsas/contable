'use server';

import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { revalidateCompanyRoutes } from '@/modules/companies/shared/utils';
import type { CreateCompanyInput } from '../create/actions.server';

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {
  logoUrl?: string;
  isSingleCompany?: boolean;
}

/**
 * Actualiza una company (solo owner)
 */
export async function updateCompany(companyId: string, input: UpdateCompanyInput) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  try {
    // Verificar que el usuario es owner
    const membership = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });

    if (!membership?.isOwner) {
      throw new Error('Solo el propietario puede editar la empresa');
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: input.name,
        taxId: input.taxId,
        taxStatus: input.taxStatus,
        description: input.description,
        email: input.email,
        phone: input.phone,
        address: input.address,
        country: input.country,
        industry: input.industry,
        logoUrl: input.logoUrl,
        provinceId: input.provinceId,
        cityId: input.cityId,
        isSingleCompany: input.isSingleCompany,
      },
    });

    logger.info('Company actualizada', { data: { companyId, userId } });
    revalidateCompanyRoutes(companyId);

    return company;
  } catch (error) {
    logger.error('Error al actualizar company', { data: { error, companyId, userId } });
    throw error;
  }
}
