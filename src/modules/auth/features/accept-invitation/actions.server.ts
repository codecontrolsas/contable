'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getCurrentUser, getCurrentUserId } from '@/shared/lib/current-user';

/**
 * Obtiene una invitación por su token
 */
export async function getInvitationByToken(token: string) {
  try {
    return await prisma.companyInvitation.findUnique({
      where: { token },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        assignedRole: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            pictureUrl: true,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error al buscar invitación', { data: { error, token } });
    return null;
  }
}

/**
 * Acepta una invitación y crea el CompanyMember
 */
export async function acceptInvitation(token: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Debes iniciar sesión para aceptar la invitación');
  }

  const invitation = await prisma.companyInvitation.findUnique({
    where: { token },
    include: {
      company: { select: { id: true, name: true } },
      assignedRole: { select: { id: true, name: true } },
      employee: { select: { id: true } },
    },
  });

  if (!invitation) {
    throw new Error('Invitación no encontrada');
  }

  if (invitation.acceptedAt) {
    throw new Error('Esta invitación ya fue aceptada');
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error('Esta invitación ha expirado');
  }

  // Validar que el email del usuario coincida con el de la invitación
  const currentUser = await getCurrentUser();
  const userEmail = currentUser?.email;

  if (userEmail?.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error(
      `Esta invitación es para ${invitation.email}. Iniciá sesión con esa cuenta.`
    );
  }

  // Verificar que no sea ya miembro
  const existingMember = await prisma.companyMember.findFirst({
    where: { companyId: invitation.companyId, userId },
    select: { id: true },
  });

  if (existingMember) {
    throw new Error('Ya eres miembro de esta empresa');
  }

  // Verificar que el empleado vinculado sigue disponible
  let employeeIdToLink = invitation.employeeId;
  if (employeeIdToLink) {
    const employeeAvailable = await prisma.employee.findFirst({
      where: {
        id: employeeIdToLink,
        companyId: invitation.companyId,
        isActive: true,
        companyMember: null,
      },
      select: { id: true },
    });

    if (!employeeAvailable) {
      logger.warn('Empleado ya no disponible para vincular', {
        data: { employeeId: employeeIdToLink, invitationId: invitation.id },
      });
      employeeIdToLink = null;
    }
  }

  try {
    // Crear miembro y marcar invitación como aceptada en una transacción
    const [member] = await prisma.$transaction([
      prisma.companyMember.create({
        data: {
          userId,
          companyId: invitation.companyId,
          roleId: invitation.roleId,
          employeeId: employeeIdToLink,
          invitedBy: invitation.invitedBy,
          joinedAt: new Date(),
          isOwner: false,
          isActive: true,
        },
        select: { id: true },
      }),
      prisma.companyInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    // Nota: No usamos createAuditLog aquí porque el usuario aún no tiene empresa activa
    // El log de auditoría se registra desde el lado del que invitó (member_invited)
    logger.info('Invitación aceptada', {
      data: { invitationId: invitation.id, memberId: member.id, userId },
    });

    revalidatePath('/dashboard/company/general/users');

    return { companyId: invitation.companyId };
  } catch (error) {
    logger.error('Error al aceptar invitación', {
      data: { error, token, userId },
    });
    throw new Error('Error al aceptar la invitación');
  }
}

// Tipos inferidos
export type Invitation = Awaited<ReturnType<typeof getInvitationByToken>>;
