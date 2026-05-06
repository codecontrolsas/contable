import bcrypt from 'bcrypt';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { verifyPassword as baVerifyPassword } from 'better-auth/crypto';
import { prisma } from '@/shared/lib/prisma';
import { sendEmail } from '@/shared/lib/email';
import { ResetPasswordEmail } from '@/modules/auth/emails/ResetPasswordEmail';
import { VerifyEmailEmail } from '@/modules/auth/emails/VerifyEmailEmail';
import { bootstrapNewUser } from '@/modules/auth/features/sign-up/actions.server';

export const auth = betterAuth({
  appName: 'Contable',
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.AUTH_SECRET!,
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  advanced: {
    database: {
      generateId: false,
    },
  },
  // Remap del modelo `account` al modelo Prisma `betterAuthAccount`.
  // El modelo Prisma se llama `BetterAuthAccount` (no `Account`) porque
  // `Account` ya está usado por el plan de cuentas contable. La tabla DB
  // sigue siendo `account` (singular) gracias a `@@map`.
  account: {
    modelName: 'betterAuthAccount',
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    autoSignIn: false,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => {
        if (/^\$2[aby]\$/.test(hash)) {
          return bcrypt.compare(password, hash);
        }
        return baVerifyPassword({ hash, password });
      },
    },
    sendResetPassword: async ({ user, url }) => {
      const u = user as typeof user & { firstName?: string | null };
      await sendEmail({
        to: user.email,
        subject: 'Restablecer contraseña - Contable',
        react: <ResetPasswordEmail name={u.firstName ?? null} url={url} />,
      });
    },
    resetPasswordTokenExpiresIn: 1800,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const u = user as typeof user & { firstName?: string | null };
      await sendEmail({
        to: user.email,
        subject: 'Verificá tu email - Contable',
        react: <VerifyEmailEmail name={u.firstName ?? null} url={url} />,
      });
    },
  },
  user: {
    additionalFields: {
      firstName: { type: 'string', required: false, input: true },
      lastName: { type: 'string', required: false, input: true },
      imageKey: { type: 'string', required: false, input: false },
      legacyClerkId: { type: 'string', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const u = user as typeof user & { firstName?: string | null; lastName?: string | null };
          await bootstrapNewUser({
            userId: user.id,
            firstName: u.firstName ?? '',
            lastName: u.lastName ?? '',
            email: user.email,
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;
