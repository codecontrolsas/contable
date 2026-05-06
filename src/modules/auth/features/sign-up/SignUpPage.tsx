import { Suspense } from 'react';
import { _SignUpForm } from './components/_SignUpForm';
import type { Invitation } from '@/modules/auth/features/accept-invitation/actions.server';

interface SignUpPageProps {
  invitation?: Invitation;
  prefilledEmail?: string | null;
  token?: string | null;
}

export function SignUpPage({
  invitation = null,
  prefilledEmail = null,
  token = null,
}: SignUpPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Crear tu cuenta
          </p>
        </div>
        <Suspense fallback={null}>
          <_SignUpForm
            invitation={invitation}
            prefilledEmail={prefilledEmail}
            token={token}
          />
        </Suspense>
      </div>
    </div>
  );
}
