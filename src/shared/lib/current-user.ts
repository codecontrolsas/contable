import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';
import { getPublicUrl } from '@/shared/lib/storage';

const FRAMEWORK_DIGESTS = [
  'NEXT_REDIRECT',
  'NEXT_NOT_FOUND',
  'DYNAMIC_SERVER_USAGE',
  'BAILOUT_TO_CLIENT_SIDE_RENDERING',
];

function rethrowFrameworkError(error: unknown): void {
  if (error && typeof error === 'object' && 'digest' in error) {
    const digest = String((error as { digest?: unknown }).digest ?? '');
    if (FRAMEWORK_DIGESTS.some((f) => digest.startsWith(f))) {
      throw error;
    }
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user.id ?? null;
  } catch (error) {
    rethrowFrameworkError(error);
    logger.error('Error obteniendo userId actual', { data: { error } });
    return null;
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    const u = session.user as typeof session.user & {
      firstName?: string | null;
      lastName?: string | null;
      imageKey?: string | null;
    };
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      imageUrl: u.imageKey ? getPublicUrl(u.imageKey) : null,
    };
  } catch (error) {
    rethrowFrameworkError(error);
    logger.error('Error obteniendo usuario actual', { data: { error } });
    return null;
  }
}
