'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getCurrentUserId } from '@/shared/lib/current-user';
import { onboardingSchema, type OnboardingInput } from './schema';

export async function completeCompanyOnboarding(
  companyId: string,
  rawInput: OnboardingInput & { logoUrl?: string | null },
) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { isOwner: true, isActive: true },
  });
  if (!member?.isActive || !member.isOwner) {
    throw new Error('No tienes permisos para completar el onboarding de esta empresa');
  }

  const parsed = onboardingSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name,
        industry: data.industry || null,
        description: data.description || null,
        taxId: data.taxId || null,
        taxStatus: data.taxStatus || null,
        email: data.email || null,
        phone: data.phone || null,
        country: data.country || null,
        // FKs: en CompanyUpdateInput de Prisma no se puede setear `null` directo;
        // solo aceptan number | undefined. Para limpiar habría que usar
        // `{ disconnect: true }` en la relación. Acá venimos de onboarding
        // (campos null o nuevos), así que basta con pasar el number o saltearlo.
        province: data.provinceId
          ? { connect: { id: data.provinceId } }
          : undefined,
        city: data.cityId ? { connect: { id: data.cityId } } : undefined,
        address: data.address || null,
        logoUrl: rawInput.logoUrl ?? null,
        onboardingCompleted: true,
      },
    });
    logger.info('Onboarding completado', { data: { userId, companyId } });
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    logger.error('Error completando onboarding', { data: { userId, companyId, error } });
    throw new Error('No se pudo guardar la empresa');
  }
}
