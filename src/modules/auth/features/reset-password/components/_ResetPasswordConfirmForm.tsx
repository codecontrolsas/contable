'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { authClient } from '@/shared/lib/auth-client';
import { Button } from '@/shared/components/ui/button';
import { PasswordInput } from '@/shared/components/ui/password-input';
import { Label } from '@/shared/components/ui/label';
import { confirmSchema, type ConfirmInput } from '../schema';

interface Props {
  token: string;
}

export function _ResetPasswordConfirmForm({ token }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ConfirmInput>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ConfirmInput) => {
    setSubmitting(true);
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? 'Token inválido o expirado');
      return;
    }

    toast.success('Contraseña actualizada. Iniciá sesión.');
    router.push('/sign-in');
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <PasswordInput id="password" {...form.register('password')} disabled={submitting} />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <PasswordInput
          id="confirmPassword"
          {...form.register('confirmPassword')}
          disabled={submitting}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Actualizar contraseña
      </Button>
    </form>
  );
}
