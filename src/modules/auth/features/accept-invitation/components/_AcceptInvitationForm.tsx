'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/shared/lib/auth-client';
import { toast } from 'sonner';
import { Building2, Mail, UserCircle, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { acceptInvitation, type Invitation } from '../actions.server';

interface Props {
  invitation: Invitation;
  token: string;
}

export function _AcceptInvitationForm({ invitation, token }: Props) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isSignedIn = !!session;
  const user = session?.user;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Evitar flicker mientras se resuelve la sesión inicial
  if (sessionPending) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Cargando…</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Caso: Invitación no encontrada
  if (!invitation) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Invitación no encontrada</CardTitle>
          <CardDescription>
            El enlace de invitación no es válido o ha sido eliminado.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button variant="outline" onClick={() => router.push('/sign-in')}>
            Ir a iniciar sesión
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Caso: Invitación ya aceptada
  if (invitation.acceptedAt) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Invitación ya aceptada</CardTitle>
          <CardDescription>
            Esta invitación ya fue utilizada anteriormente.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button onClick={() => router.push('/dashboard')}>
            Ir al dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Caso: Invitación expirada
  if (invitation.expiresAt < new Date()) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle>Invitación expirada</CardTitle>
          <CardDescription>
            Esta invitación ha expirado. Contacta al administrador para solicitar
            una nueva invitación.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button variant="outline" onClick={() => router.push('/sign-in')}>
            Ir a iniciar sesión
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const userEmail = user?.email;
  const emailMatches =
    userEmail?.toLowerCase() === invitation.email.toLowerCase();

  // Caso: Usuario logueado pero email no coincide
  if (isSignedIn && !emailMatches) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Mail className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle>Email incorrecto</CardTitle>
          <CardDescription>
            Esta invitación es para <strong>{invitation.email}</strong>.
            <br />
            Actualmente estás conectado como <strong>{userEmail}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{invitation.company?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Rol: {invitation.assignedRole?.name}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => {
              void authClient.signOut({
                fetchOptions: {
                  onSuccess: () =>
                    router.push(
                      `/sign-in?redirect=${encodeURIComponent(`/invite?token=${token}`)}`
                    ),
                },
              });
            }}
          >
            Cerrar sesión e iniciar con otra cuenta
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Caso: Usuario NO logueado
  if (!isSignedIn) {
    const redirectUrl = encodeURIComponent(`/invite?token=${token}`);
    const signUpUrl = `/sign-up?invitation=${token}&email=${encodeURIComponent(invitation.email)}`;
    const signInUrl = `/sign-in?redirect=${redirectUrl}&invitation=${token}`;

    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Has sido invitado</CardTitle>
          <CardDescription>
            Para continuar, inicia sesión o crea una cuenta con el email:{' '}
            <strong>{invitation.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{invitation.company?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Rol: {invitation.assignedRole?.name}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => router.push(signUpUrl)}
          >
            Crear cuenta
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(signInUrl)}
          >
            Ya tengo cuenta
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Caso: Usuario logueado Y email coincide - puede aceptar
  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      try {
        await acceptInvitation(token);
        toast.success('Invitación aceptada');
        router.push('/dashboard');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al aceptar la invitación';
        setError(message);
        toast.error(message);
      }
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Invitación a {invitation.company?.name}</CardTitle>
        <CardDescription>
          Has sido invitado a unirte como <strong>{invitation.assignedRole?.name}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Empresa</p>
              <p className="font-medium">{invitation.company?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Rol asignado</p>
              <p className="font-medium">{invitation.assignedRole?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Tu cuenta</p>
              <p className="font-medium">{userEmail}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleAccept} disabled={isPending}>
          {isPending ? 'Aceptando...' : 'Aceptar invitación'}
        </Button>
      </CardFooter>
    </Card>
  );
}
