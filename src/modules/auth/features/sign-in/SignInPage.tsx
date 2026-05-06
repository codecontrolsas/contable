import { Suspense } from 'react';
import { _SignInForm } from './components/_SignInForm';

export function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">Ingresá a tu cuenta</p>
        </div>
        <Suspense>
          <_SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
