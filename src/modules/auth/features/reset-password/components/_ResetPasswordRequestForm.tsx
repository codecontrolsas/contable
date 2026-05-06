'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { authClient } from '@/shared/lib/auth-client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { requestSchema, type RequestInput } from '../schema';

export function _ResetPasswordRequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<RequestInput>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: RequestInput) => {
    setSubmitting(true);
    await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: '/reset-password',
    });
    setSubmitting(false);
    setSent(true);
    toast.success('Si el email existe, te enviamos un link para restablecer.');
  };

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        Revisá tu casilla. Si no llega en unos minutos, revisá spam.
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...form.register('email')} disabled={submitting} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enviar link
      </Button>
    </form>
  );
}
