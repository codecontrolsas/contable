import 'server-only';
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { logger } from '@/shared/lib/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS! }
    : undefined,
});

interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
}

/**
 * Envía un email renderizando el componente React a HTML.
 * Usa el transporter SMTP definido por las variables SMTP_*.
 */
export async function sendEmail(params: SendEmailParams) {
  const html = await render(params.react);
  const text = await render(params.react, { plainText: true });
  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@example.com',
      to: params.to,
      subject: params.subject,
      html,
      text,
    });
    logger.info('Email enviado', { data: { to: params.to, messageId: result.messageId } });
    return result;
  } catch (error) {
    logger.error('Error enviando email', { data: { error, to: params.to } });
    throw error;
  }
}
