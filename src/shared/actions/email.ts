'use server';

import { sendEmail } from '@/shared/lib/email';
import { InvitationEmail } from '@/shared/emails/InvitationEmail';
import { logger } from '@/shared/lib/logger';

interface SendInvitationEmailParams {
  to: string;
  inviteUrl: string;
  companyName: string;
  roleName: string;
  invitedByName: string;
  expiresAt: Date;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  try {
    await sendEmail({
      to: params.to,
      subject: `Invitación a unirte a ${params.companyName}`,
      react: InvitationEmail({
        inviteUrl: params.inviteUrl,
        companyName: params.companyName,
        roleName: params.roleName,
        invitedByName: params.invitedByName,
        expiresAt: params.expiresAt,
      }),
    });
    logger.info('Email de invitación enviado', { data: { to: params.to } });
  } catch (error) {
    logger.error('Error enviando email de invitación', { data: { error, to: params.to } });
    throw new Error('Error al enviar email de invitación');
  }
}
