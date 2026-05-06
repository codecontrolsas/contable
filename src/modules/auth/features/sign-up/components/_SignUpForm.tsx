'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { authClient } from '@/shared/lib/auth-client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { PasswordInput } from '@/shared/components/ui/password-input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/utils';
import { signUpSchema, type SignUpInput } from '../schema';
import type { Invitation } from '@/modules/auth/features/accept-invitation/actions.server';

interface SignUpFormProps {
  invitation: Invitation;
  prefilledEmail: string | null;
  token: string | null;
}

export function _SignUpForm({ invitation, prefilledEmail, token }: SignUpFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const validInvitation =
    invitation && !invitation.acceptedAt && invitation.expiresAt > new Date()
      ? invitation
      : null;

  const invalidTokenAttempt = !!token && !validInvitation;

  const defaultEmail =
    validInvitation?.email ?? prefilledEmail ?? params.get('email') ?? '';

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: defaultEmail,
      password: '',
      firstName: '',
      lastName: '',
    },
  });

  const onSubmit = async (values: SignUpInput) => {
    setSubmitting(true);
    const invitationToken = token ?? params.get('invitation');
    const callbackURL =
      validInvitation && invitationToken
        ? `/invite?token=${invitationToken}`
        : '/dashboard';

    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      firstName: values.firstName,
      lastName: values.lastName,
      name: `${values.firstName} ${values.lastName}`.trim(),
      callbackURL,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? 'Error al crear la cuenta');
      return;
    }

    if (invitationToken) {
      toast.success('Cuenta creada. Verificá tu email; después aceptaremos la invitación.');
      router.push(`/sign-in?verify=pending&invitation=${invitationToken}`);
      return;
    }
    toast.success('Cuenta creada. Revisá tu email para verificar.');
    router.push('/sign-in?verify=pending');
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {validInvitation && (
        <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary/80">Invitación</p>
          <p className="text-sm">
            Estás creando cuenta para unirte a{' '}
            <strong>{validInvitation.company?.name}</strong> como{' '}
            <strong>{validInvitation.assignedRole?.name ?? 'miembro'}</strong>.
          </p>
        </div>
      )}

      {invalidTokenAttempt && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            El link de invitación no es válido o ha expirado. Podés crear una cuenta normal.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" {...form.register('firstName')} disabled={submitting} />
          {form.formState.errors.firstName && (
            <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" {...form.register('lastName')} disabled={submitting} />
          {form.formState.errors.lastName && (
            <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          readOnly={!!validInvitation}
          className={cn(validInvitation && 'cursor-not-allowed bg-muted/50')}
          {...form.register('email')}
          disabled={submitting}
        />
        {validInvitation && (
          <p className="text-xs text-muted-foreground">
            Este email no se puede cambiar porque está vinculado a la invitación.
          </p>
        )}
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput id="password" autoComplete="new-password" {...form.register('password')} disabled={submitting} />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Mínimo 8 caracteres, una mayúscula y un número.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link href="/sign-in" className="text-primary underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
