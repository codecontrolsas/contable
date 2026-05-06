'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';

import { authClient } from '@/shared/lib/auth-client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { PasswordInput } from '@/shared/components/ui/password-input';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { signInSchema, type SignInInput } from '../schema';

// Mapeo de errores comunes de Better Auth (ingles) -> mensajes en espanol.
function translateAuthError(error: { code?: string; message?: string } | null | undefined): string {
  const code = error?.code?.toUpperCase();
  const msg = error?.message?.toLowerCase() ?? '';

  if (code === 'INVALID_EMAIL_OR_PASSWORD' || msg.includes('invalid') && msg.includes('password')) {
    return 'Email o contrasena incorrectos.';
  }
  if (code === 'EMAIL_NOT_VERIFIED' || msg.includes('not verified') || msg.includes('verify')) {
    return 'Tu email aun no fue verificado. Revisa tu casilla.';
  }
  if (code === 'USER_NOT_FOUND' || msg.includes('not found')) {
    return 'No existe una cuenta con ese email.';
  }
  if (code === 'TOO_MANY_REQUESTS' || msg.includes('too many')) {
    return 'Demasiados intentos. Esperá unos minutos antes de volver a intentar.';
  }
  if (code === 'BANNED' || msg.includes('banned') || msg.includes('disabled')) {
    return 'Tu cuenta esta deshabilitada. Contactá a un administrador.';
  }
  return error?.message || 'No pudimos iniciar sesion. Intentá nuevamente.';
}

export function _SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/dashboard';
  const verifyPending = params.get('verify') === 'pending';
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', rememberMe: true } as SignInInput,
  });

  const onSubmit = async (values: SignInInput) => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });

      if (error) {
        const message = translateAuthError(error);
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const invitation = params.get('invitation');
      if (invitation) {
        router.push(`/invite?token=${invitation}`);
        return;
      }
      router.push(redirect);
    } catch (err) {
      // Errores no controlados (red, CORS, timeout, etc.)
      const message =
        err instanceof Error && err.message
          ? `No pudimos conectar con el servidor: ${err.message}`
          : 'No pudimos conectar con el servidor. Verificá tu conexión e intentá de nuevo.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {verifyPending && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Te enviamos un email de verificación. Verificá tu cuenta antes de iniciar sesión.
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...form.register('email')}
          disabled={submitting}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link href="/reset-password" className="text-xs text-primary underline">
            Olvidé mi contraseña
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          {...form.register('password')}
          disabled={submitting}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <Checkbox
              id="rememberMe"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              disabled={submitting}
            />
          )}
        />
        <Label htmlFor="rememberMe" className="text-sm font-normal">
          Recordarme
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Iniciar sesión
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{' '}
        <Link href="/sign-up" className="text-primary underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
