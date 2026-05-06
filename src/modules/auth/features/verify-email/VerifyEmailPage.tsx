'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { authClient } from '@/shared/lib/auth-client';
import { Button } from '@/shared/components/ui/button';

export function VerifyEmailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    (async () => {
      const { error } = await authClient.verifyEmail({ query: { token } });
      if (error) {
        setStatus('error');
        toast.error(error.message ?? 'Token inválido o expirado');
      } else {
        setStatus('success');
        toast.success('Email verificado');
        setTimeout(() => router.push('/dashboard'), 1500);
      }
    })();
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 text-center shadow-sm">
        {status === 'verifying' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="text-2xl font-bold">Verificando email...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold">¡Email verificado!</h1>
            <p className="text-sm text-muted-foreground">Redirigiendo al dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold">Token inválido</h1>
            <p className="text-sm text-muted-foreground">El link expiró o ya fue usado.</p>
            <Button onClick={() => router.push('/sign-in')}>Iniciar sesión</Button>
          </>
        )}
      </div>
    </div>
  );
}
