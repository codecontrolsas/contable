import Link from 'next/link';
import { Building2, Mail } from 'lucide-react';

import { APP_NAME } from '@/shared/config/instance';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { getCurrentUser } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';

import { _CreateCompanyForm } from '../components/_CreateCompanyForm';

/**
 * Fallback que se muestra cuando el usuario no tiene ninguna empresa.
 *
 * Server Component:
 * - Si hay una invitación pendiente para el email del usuario, muestra una
 *   tarjeta con CTA para aceptarla.
 * - Si no, muestra el formulario de crear empresa.
 */
export async function NoCompanyFallback() {
  const user = await getCurrentUser();

  const pendingInvitation = user?.email
    ? await prisma.companyInvitation.findFirst({
        where: {
          email: { equals: user.email, mode: 'insensitive' },
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          company: { select: { name: true } },
          assignedRole: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  if (pendingInvitation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Tenés una invitación pendiente</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            Fuiste invitado/a a unirte a{' '}
            <span className="font-semibold">{pendingInvitation.company.name}</span>
            {pendingInvitation.assignedRole?.name && (
              <>
                {' '}
                como{' '}
                <span className="font-semibold">{pendingInvitation.assignedRole.name}</span>
              </>
            )}
            . Aceptala para empezar a usar {APP_NAME}.
          </p>
        </div>

        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col gap-4 pt-6">
            <Button asChild className="w-full">
              <Link href={`/invite?token=${pendingInvitation.token}`}>
                Aceptar invitación a {pendingInvitation.company.name}
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              ¿No esperabas esta invitación? Podés crear tu propia empresa en lugar de aceptarla.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-4">
          <Building2 className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Bienvenido a {APP_NAME}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Para comenzar a gestionar tus recursos, empleados y operaciones, primero necesitas
          crear o unirte a una empresa.
        </p>
      </div>

      <_CreateCompanyForm isFirstCompany />
    </div>
  );
}
