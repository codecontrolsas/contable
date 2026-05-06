# Migración Clerk → Better Auth (contable)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Goal:** Reemplazar Clerk por Better Auth como sistema de autenticación, manteniendo a los usuarios actuales operativos con sus mismas passwords (importadas vía CSV de Clerk + bcrypt) y agregando un wizard de onboarding mandatorio post-signup.

**Architecture:**
- Better Auth con Prisma adapter, email/password, verificación de email + reset password vía SMTP propio (Nodemailer).
- Schema BA: `user/session/account/verification` (modelo Prisma del account = `BetterAuthAccount` para evitar colisión con el `Account` contable existente).
- Helper unificado `getCurrentUserId/getCurrentUser` en `src/shared/lib/current-user.ts`.
- Middleware reescrito a `auth.api.getSession`; `ClerkProvider` removido.
- Bcrypt smart verify: detecta hashes bcrypt de Clerk y delega a scrypt nativo de BA para los usuarios nuevos.
- Migración SQL idempotente que importa usuarios desde CSV con sus hashes bcrypt y reescribe FKs string que guardan Clerk IDs (CompanyMember.userId, CompanyInvitation.invitedBy, UserPreference.userId, PermissionAuditLog.performedBy, CompanyMemberPermission.assignedBy, etc.).
- Onboarding wizard mandatorio modal de 4 pasos (identidad, fiscal, contacto, branding) con flag `Company.onboardingCompleted`.

**Tech Stack:** Next.js 16.1.3, React 19, Prisma 7, Better Auth 1.6.x, Nodemailer 8, bcrypt 6, csv-parse 6, @react-email/render 2.

**Base reference:** Migración análoga ya hecha en repo hermano `ecokit` (commits `2e91e14`, `5f23ea9`, `40313ed`, `1748e66`, `d449edf`, `6777a88`). Cuando este plan diga "como ecokit" referirse a esos commits.

**Working branch:** `feat/clerk-to-better-auth` (creada desde `main`).

---

## File Structure

### Archivos a crear

```
.env.example                                          # nuevo (no existe)
scripts/import-clerk-users.ts                         # script CSV → BA users

prisma/migrations/<TS>_better_auth_init/migration.sql            # tablas BA
prisma/migrations/<TS>_better_auth_uuid_ids/migration.sql        # IDs UUID
prisma/migrations/<TS>_company_add_onboarding_completed/migration.sql
prisma/migrations/<TS>_import_clerk_users_and_rewrite_fks/migration.sql

src/shared/lib/auth.tsx                               # config Better Auth
src/shared/lib/auth-client.ts                         # client BA
src/shared/lib/current-user.ts                        # getCurrentUserId/getCurrentUser
src/app/api/auth/[...all]/route.ts                    # handler BA

src/app/(auth)/sign-in/page.tsx                       # nueva (reemplaza catchall)
src/app/(auth)/sign-up/page.tsx                       # nueva (reemplaza catchall)
src/app/(auth)/reset-password/page.tsx                # nueva
src/app/(auth)/verify-email/page.tsx                  # nueva

src/modules/auth/features/sign-in/SignInPage.tsx
src/modules/auth/features/sign-in/components/_SignInForm.tsx
src/modules/auth/features/sign-in/schema.ts
src/modules/auth/features/sign-in/index.ts

src/modules/auth/features/sign-up/SignUpPage.tsx
src/modules/auth/features/sign-up/components/_SignUpForm.tsx
src/modules/auth/features/sign-up/actions.server.ts   # bootstrapNewUser
src/modules/auth/features/sign-up/schema.ts
src/modules/auth/features/sign-up/index.ts

src/modules/auth/features/reset-password/ResetPasswordRequestPage.tsx
src/modules/auth/features/reset-password/ResetPasswordConfirmPage.tsx
src/modules/auth/features/reset-password/components/_ResetPasswordRequestForm.tsx
src/modules/auth/features/reset-password/components/_ResetPasswordConfirmForm.tsx
src/modules/auth/features/reset-password/schema.ts
src/modules/auth/features/reset-password/index.ts

src/modules/auth/features/verify-email/VerifyEmailPage.tsx
src/modules/auth/features/verify-email/index.ts

src/modules/auth/emails/ResetPasswordEmail.tsx
src/modules/auth/emails/VerifyEmailEmail.tsx

src/modules/onboarding/features/company-setup/OnboardingGate.tsx
src/modules/onboarding/features/company-setup/actions.server.ts
src/modules/onboarding/features/company-setup/schema.ts
src/modules/onboarding/features/company-setup/index.ts
src/modules/onboarding/features/company-setup/components/_OnboardingDialog.tsx
src/modules/onboarding/features/company-setup/components/_StepIndicator.tsx
src/modules/onboarding/features/company-setup/components/_ProgressDots.tsx
src/modules/onboarding/features/company-setup/components/_StepHeader.tsx
src/modules/onboarding/features/company-setup/components/_StepIdentity.tsx
src/modules/onboarding/features/company-setup/components/_StepFiscal.tsx
src/modules/onboarding/features/company-setup/components/_StepContact.tsx
src/modules/onboarding/features/company-setup/components/_StepBranding.tsx

src/shared/lib/email.ts                               # ↻ reemplazo (Nodemailer)
```

### Archivos a modificar

```
package.json                                          # +better-auth +bcrypt +nodemailer +csv-parse +@react-email/render -clerk
prisma/schema.prisma                                  # +User/Session/BetterAuthAccount/Verification +Company.onboardingCompleted
.env / .env.production                                # +AUTH_SECRET +SMTP_* -CLERK_*
src/proxy.ts                                          # clerkMiddleware → BA proxy
src/providers/SessionProvider.tsx                     # ClerkProvider → pass-through
src/app/page.tsx                                      # quitar SignInButton/SignUpButton/UserButton de Clerk
src/shared/lib/company.ts                             # auth() → getCurrentUserId()
src/shared/lib/permissions/audit.server.ts            # auth() → getCurrentUserId()
src/shared/lib/permissions/getPermissions.server.ts   # auth() → getCurrentUserId()
src/shared/actions/table-preferences.ts               # auth() → getCurrentUserId()
src/shared/components/layout/nav/_NavUser.tsx         # useUser/useClerk → authClient
src/shared/actions/email.ts                           # transporter Nodemailer
src/modules/auth/features/accept-invitation/actions.server.ts  # clerkClient → prisma.user
src/modules/auth/features/accept-invitation/components/_AcceptInvitationForm.tsx  # useUser → authClient.useSession
src/modules/company/features/general/users/actions.server.ts   # clerkClient → prisma.user
src/modules/company/features/general/users/UsersList.tsx       # auth() → getCurrentUserId()
src/modules/company/features/general/audit/actions.server.ts   # clerkClient → prisma.user
src/modules/company/features/general/roles/actions.server.ts   # auth() → getCurrentUserId()
src/modules/companies/features/create/components/NoCompanyFallback.tsx  # +CTA invitación pendiente

# Server actions con `auth()` (~50 archivos): refactor en bloque a getCurrentUserId()
# (lista completa enumerada en la Tarea 32)

# API PDF routes (8 archivos): src/app/api/{invoices,quotes,receipts,delivery-notes,
#   purchase-orders,purchase-invoices,payment-orders,receiving-notes,stock-transfers}/[id]/pdf/route.ts
```

### Archivos a eliminar

```
src/app/(auth)/sign-in/[[...sign-in]]/                # carpeta entera (Clerk catchall)
src/app/(auth)/sign-up/[[...sign-up]]/                # carpeta entera (Clerk catchall)
```

---

## Sequencing

El orden importa porque hay dependencias fuertes:

1. **Fase 0 (Prep):** dependencias + .env.
2. **Fase 1 (Email):** migrar Resend → Nodemailer ANTES de configurar BA (BA depende de `sendEmail`).
3. **Fase 2 (Schema BA):** modelos Prisma + migraciones de DDL puro (todavía sin import).
4. **Fase 3 (Core BA):** `auth.tsx`, `auth-client.ts`, `current-user.ts`, route handler.
5. **Fase 4 (Páginas auth):** sign-in/sign-up/reset/verify + landing limpia.
6. **Fase 5 (Middleware + Provider):** `proxy.ts` y `SessionProvider.tsx` — recién acá la app deja de ser Clerk-friendly. Antes de este punto la app sigue corriendo con Clerk.
7. **Fase 6 (Refactor masivo):** reemplazar `auth()`/`clerkClient()`/`useUser()` por helpers BA en TODOS los archivos. Acá cambia la mayor parte del código.
8. **Fase 7 (Onboarding):** wizard + gate.
9. **Fase 8 (Import):** migración SQL con users + script CSV. Login de usuarios viejos funciona.
10. **Fase 9 (Cleanup):** desinstalar paquetes Clerk, validar tipos+lint.

---

# FASE 0 — Preparación

### Task 1: Instalar dependencias nuevas

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Agregar deps de Better Auth, bcrypt, nodemailer, csv-parse, @react-email/render**

```bash
npm install better-auth@^1.6.9 bcrypt@^6.0.0 nodemailer@^8.0.7 csv-parse@^6.2.1 @react-email/render@^2.0.7
```

- [ ] **Step 2: Agregar dev deps de tipos**

```bash
npm install -D @types/bcrypt@^6.0.0 @types/nodemailer@^8.0.0
```

- [ ] **Step 3: Verificar que el install no rompió el árbol**

```bash
npm run check-types
```
Esperado: sin errores de tipo (todavía no agregamos código nuevo, los warnings deberían ser los preexistentes).

---

### Task 2: Crear `.env.example` y agregar variables

**Files:** `.env.example` (crear), `.env` (modificar local), `.env.production` (modificar para deploy)

- [ ] **Step 1: Crear `.env.example` con todas las variables necesarias**

Crear archivo en raíz con este contenido:

```env
# ============================================
# BASE DE DATOS
# ============================================
DATABASE_URL="postgresql://postgres:postgres@localhost:5533/nahuel-boxer-db-boxer-db"

# ============================================
# AUTENTICACIÓN - Better Auth
# ============================================
# Generar con: openssl rand -hex 32
AUTH_SECRET=""
NEXT_PUBLIC_APP_URL="http://localhost:3001"

# ============================================
# EMAIL - SMTP (Nodemailer)
# ============================================
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="No-Reply <noreply@example.com>"
SMTP_SECURE="false"

# ============================================
# STORAGE (existentes)
# ============================================
STORAGE_PROVIDER="s3"
S3_ENDPOINT="http://localhost:9002"
S3_REGION="us-east-1"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin123"
S3_BUCKET="contable"
S3_PUBLIC_URL="http://localhost:9002/contable"
```

- [ ] **Step 2: Agregar las nuevas variables al `.env` local del usuario**

Pedir al usuario que agregue manualmente o agregar al final de `.env` (sin tocar las existentes):

```env
AUTH_SECRET="<correr `openssl rand -hex 32`>"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="No-Reply <noreply@example.com>"
SMTP_SECURE="false"
```

- [ ] **Step 3: Actualizar `.env.production`** — quitar `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (la deja como referencia comentada para borrar después del deploy exitoso) y agregar:

```env
# AUTH_SECRET y SMTP_* se inyectan en el VPS, no se commitean acá
```

---

# FASE 1 — Migrar Email a Nodemailer

### Task 3: Reescribir `src/shared/lib/email.ts` con Nodemailer

**Files:** `src/shared/lib/email.ts` (sobrescribir completo)

- [ ] **Step 1: Reemplazar el contenido del archivo con un transporter Nodemailer + helper `sendEmail`**

```typescript
import 'server-only';
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { logger } from '@/shared/lib/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS! }
    : undefined,
});

interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
}

/**
 * Envía un email renderizando el componente React a HTML.
 * Usa el transporter SMTP definido por las variables SMTP_*.
 */
export async function sendEmail(params: SendEmailParams) {
  const html = await render(params.react);
  const text = await render(params.react, { plainText: true });
  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@example.com',
      to: params.to,
      subject: params.subject,
      html,
      text,
    });
    logger.info('Email enviado', { data: { to: params.to, messageId: result.messageId } });
    return result;
  } catch (error) {
    logger.error('Error enviando email', { data: { error, to: params.to } });
    throw error;
  }
}
```

- [ ] **Step 2: Eliminar el `export` viejo `resend` y `EMAIL_FROM`**

Ya no se usan — el archivo nuevo no los exporta. Si `npm run check-types` falla en algún import, ese archivo va a aparecer en la salida y se trata en la Tarea 4.

---

### Task 4: Refactorizar `src/shared/actions/email.ts` para usar `sendEmail`

**Files:** `src/shared/actions/email.ts`

- [ ] **Step 1: Reemplazar el archivo con esta versión**

```typescript
'use server';

import { sendEmail } from '@/shared/lib/email';
import { InvitationEmail } from '@/shared/emails/InvitationEmail';
import { logger } from '@/shared/lib/logger';

interface SendInvitationEmailParams {
  to: string;
  inviteUrl: string;
  companyName: string;
  roleName: string;
  invitedByName: string;
  expiresAt: Date;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  try {
    await sendEmail({
      to: params.to,
      subject: `Invitación a unirte a ${params.companyName}`,
      react: InvitationEmail({
        inviteUrl: params.inviteUrl,
        companyName: params.companyName,
        roleName: params.roleName,
        invitedByName: params.invitedByName,
        expiresAt: params.expiresAt,
      }),
    });
    logger.info('Email de invitación enviado', { data: { to: params.to } });
  } catch (error) {
    logger.error('Error enviando email de invitación', { data: { error, to: params.to } });
    throw new Error('Error al enviar email de invitación');
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run check-types
```
Esperado: errores SOLO en archivos que importen `resend` o `EMAIL_FROM` (si quedaron). Si aparecen, listar y arreglar uno por uno (probablemente ninguno).

---

# FASE 2 — Schema Better Auth

### Task 5: Agregar modelos BA al `prisma/schema.prisma`

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Agregar al final del archivo (después del último modelo, línea 3640+)**

```prisma
// ============================================
// BETTER AUTH - Tablas de autenticación
// ============================================

model User {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email         String   @unique
  emailVerified Boolean  @default(false) @map("email_verified")
  name          String
  image         String?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Campos extendidos
  firstName     String? @map("first_name")
  lastName      String? @map("last_name")
  imageKey      String? @map("image_key")
  imageUrl      String? @map("image_url")
  legacyClerkId String? @unique @map("legacy_clerk_id")

  sessions Session[]
  accounts BetterAuthAccount[]

  @@map("user")
}

model Session {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  expiresAt DateTime @map("expires_at")
  token     String   @unique
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("session")
}

// IMPORTANTE: el modelo se llama BetterAuthAccount (no Account) porque
// ya existe `model Account` para el Plan de Cuentas contable.
// La tabla DB es `account` (singular), distinta de `accounts` (plural)
// del plan contable, así que no hay colisión a nivel SQL.
model BetterAuthAccount {
  id                    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  accountId             String    @map("account_id")
  providerId            String    @map("provider_id")
  userId                String    @map("user_id") @db.Uuid
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  password              String?
  accessToken           String?   @map("access_token")
  refreshToken          String?   @map("refresh_token")
  idToken               String?   @map("id_token")
  accessTokenExpiresAt  DateTime? @map("access_token_expires_at")
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at")
  scope                 String?
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  identifier String
  value      String
  expiresAt  DateTime @map("expires_at")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@index([identifier])
  @@map("verification")
}
```

- [ ] **Step 2: Agregar campo `onboardingCompleted` al `model Company`** (alrededor de la línea 91, después de `isSingleCompany`):

```prisma
  isSingleCompany Boolean    @default(false) @map("is_single_company")
  onboardingCompleted Boolean @default(false) @map("onboarding_completed")
  activeModules   String[]   @default([]) @map("active_modules")
```

- [ ] **Step 3: Generar el cliente Prisma**

```bash
npm run db:generate
```
Esperado: client regenerado sin errores. El nombre `BetterAuthAccount` no choca con el `Account` contable porque son distintos identifiers Prisma.

---

### Task 6: Crear migración SQL para tablas Better Auth

**Files:** `prisma/migrations/<TS>_better_auth_init/migration.sql`

- [ ] **Step 1: Generar la migración**

```bash
npm run db:migrate -- --name better_auth_init --create-only
```
Esperado: prisma crea la carpeta `prisma/migrations/<timestamp>_better_auth_init/` con `migration.sql` que contiene el DDL.

- [ ] **Step 2: Verificar que el SQL generado contiene las 4 tablas (`user`, `session`, `account`, `verification`) con los UUIDs correctos**

Abrir `prisma/migrations/<TS>_better_auth_init/migration.sql` y validar que tiene:
- `CREATE TABLE "user"` con `id UUID NOT NULL DEFAULT gen_random_uuid()`
- `CREATE TABLE "session"` con `id UUID` y `user_id UUID`
- `CREATE TABLE "account"` con `id UUID` y `user_id UUID`
- `CREATE TABLE "verification"` con `id UUID`
- Índices y FKs

Si por algún motivo Prisma generó IDs como `TEXT` en lugar de `UUID`, ajustar manualmente cambiando `id TEXT` → `id UUID NOT NULL DEFAULT gen_random_uuid()` y los `user_id TEXT` → `user_id UUID`.

- [ ] **Step 3: Aplicar la migración**

```bash
npm run db:migrate -- --name better_auth_init
```
Esperado: migración aplicada, tablas creadas.

- [ ] **Step 4: Verificar tablas creadas**

```bash
docker exec nahuel-boxer-db psql -U postgres -d nahuel-boxer-db-boxer-db -c "\dt user account session verification"
```
Esperado: 4 tablas listadas.

---

### Task 7: Crear migración para `Company.onboardingCompleted`

**Files:** `prisma/migrations/<TS>_company_add_onboarding_completed/migration.sql`

- [ ] **Step 1: Generar migración**

```bash
npm run db:migrate -- --name company_add_onboarding_completed --create-only
```

- [ ] **Step 2: Editar el SQL para que las companies existentes queden marcadas como `true`** (no queremos que el wizard les aparezca a empresas ya configuradas):

Sobrescribir el contenido con:

```sql
-- Agrega flag para forzar wizard de onboarding en empresas nuevas
ALTER TABLE "companies" ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- Marcar como completed las companies existentes para que no muestren el wizard
UPDATE "companies" SET "onboarding_completed" = true WHERE "created_at" < NOW();
```

- [ ] **Step 3: Aplicar**

```bash
npm run db:migrate -- --name company_add_onboarding_completed
```
Esperado: companies existentes con `onboarding_completed = true`.

---

# FASE 3 — Better Auth Core

### Task 8: Crear `src/shared/lib/auth.tsx`

**Files:** `src/shared/lib/auth.tsx` (crear)

- [ ] **Step 1: Crear el archivo con esta config**

```typescript
import bcrypt from 'bcrypt';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { verifyPassword as baVerifyPassword } from 'better-auth/crypto';
import { prisma } from '@/shared/lib/prisma';
import { sendEmail } from '@/shared/lib/email';
import { ResetPasswordEmail } from '@/modules/auth/emails/ResetPasswordEmail';
import { VerifyEmailEmail } from '@/modules/auth/emails/VerifyEmailEmail';
import { bootstrapNewUser } from '@/modules/auth/features/sign-up/actions.server';

export const auth = betterAuth({
  appName: 'Contable',
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.AUTH_SECRET!,
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  advanced: {
    database: {
      generateId: false,
    },
  },
  // Remap del modelo `account` al modelo Prisma `betterAuthAccount`.
  // El modelo Prisma se llama `BetterAuthAccount` (no `Account`) porque
  // `Account` ya está usado por el plan de cuentas contable. La tabla DB
  // sigue siendo `account` (singular) gracias a `@@map`.
  account: {
    modelName: 'betterAuthAccount',
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    autoSignIn: false,
    password: {
      // Hashes nuevos: bcrypt para mantener compatibilidad con Clerk export.
      hash: async (password) => bcrypt.hash(password, 10),
      // Verify smart: bcrypt-shaped → bcrypt; otro → scrypt nativo de BA.
      verify: async ({ hash, password }) => {
        if (/^\$2[aby]\$/.test(hash)) {
          return bcrypt.compare(password, hash);
        }
        return baVerifyPassword({ hash, password });
      },
    },
    sendResetPassword: async ({ user, url }) => {
      const u = user as typeof user & { firstName?: string | null };
      await sendEmail({
        to: user.email,
        subject: 'Restablecer contraseña - Contable',
        react: <ResetPasswordEmail name={u.firstName ?? null} url={url} />,
      });
    },
    resetPasswordTokenExpiresIn: 1800,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const u = user as typeof user & { firstName?: string | null };
      await sendEmail({
        to: user.email,
        subject: 'Verificá tu email - Contable',
        react: <VerifyEmailEmail name={u.firstName ?? null} url={url} />,
      });
    },
  },
  user: {
    additionalFields: {
      firstName: { type: 'string', required: false, input: true },
      lastName: { type: 'string', required: false, input: true },
      imageKey: { type: 'string', required: false, input: false },
      legacyClerkId: { type: 'string', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const u = user as typeof user & { firstName?: string | null; lastName?: string | null };
          await bootstrapNewUser({
            userId: user.id,
            firstName: u.firstName ?? '',
            lastName: u.lastName ?? '',
            email: user.email,
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;
```

- [ ] **Step 2: NO ejecutar `check-types` todavía** — `bootstrapNewUser`, `ResetPasswordEmail` y `VerifyEmailEmail` aún no existen. Se crean en Tareas 11, 13 y 12 respectivamente. Se valida tipos al final de la Fase 4.

---

### Task 9: Crear `src/shared/lib/auth-client.ts`

**Files:** `src/shared/lib/auth-client.ts` (crear)

- [ ] **Step 1: Crear con este contenido**

```typescript
'use client';

import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth } from '@/shared/lib/auth';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  plugins: [inferAdditionalFields<typeof auth>()],
});
```

---

### Task 10: Crear `src/shared/lib/current-user.ts`

**Files:** `src/shared/lib/current-user.ts` (crear)

- [ ] **Step 1: Crear con este contenido**

```typescript
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

/**
 * Devuelve el ID del usuario autenticado (UUID de Better Auth) o null.
 * Usar SIEMPRE este helper en lugar de leer la sesión directamente.
 */
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

/**
 * Devuelve los datos del usuario autenticado (id, email, nombre, avatar)
 * leyendo de la sesión Better Auth.
 */
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
```

> Si `getPublicUrl` no existe en `@/shared/lib/storage`, importar la función equivalente que sí exista, o quitar la lógica de imageUrl y usar el campo `imageUrl` directamente desde `User` (ver schema). Verificar:
>
> ```bash
> grep -n "getPublicUrl" src/shared/lib/storage.ts
> ```
> Si no aparece, reemplazar el cuerpo de `getCurrentUser` por uno que lea `imageUrl` directamente del `session.user`.

---

### Task 11: Crear server action `bootstrapNewUser` en feature sign-up

**Files:** `src/modules/auth/features/sign-up/actions.server.ts` (crear)

- [ ] **Step 1: Crear el archivo**

```typescript
'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';

/**
 * Crea Company default + CompanyMember(owner) + UserPreference para un usuario
 * recién registrado. Llamado desde el hook databaseHooks.user.create.after.
 *
 * Si hay invitación pendiente para el email, NO crea Company default — el
 * usuario se va a unir a la Company de la invitación al aceptarla.
 */
export async function bootstrapNewUser(params: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const { userId, firstName, lastName, email } = params;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email;
  const companyName = `${fullName} - Empresa`;

  const pendingInvitation = await prisma.companyInvitation.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (pendingInvitation) {
    logger.info('Sign-up con invitación pendiente, skip bootstrap default', {
      data: { userId, invitationId: pendingInvitation.id },
    });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          isActive: true,
          isSingleCompany: true,
        },
        select: { id: true },
      });

      await tx.companyMember.create({
        data: {
          companyId: company.id,
          userId,
          isOwner: true,
          isActive: true,
          joinedAt: new Date(),
        },
      });

      await tx.userPreference.upsert({
        where: { userId },
        create: { userId, activeCompanyId: company.id },
        update: { activeCompanyId: company.id },
      });
    });

    logger.info('Usuario nuevo bootstrapped', { data: { userId, companyName } });
  } catch (error) {
    logger.error('Error bootstrapping usuario nuevo', { data: { userId, error } });
    throw error;
  }
}
```

---

### Task 12: Crear `VerifyEmailEmail` template

**Files:** `src/modules/auth/emails/VerifyEmailEmail.tsx` (crear)

- [ ] **Step 1: Crear el archivo**

```tsx
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components';

interface Props {
  name: string | null;
  url: string;
}

export function VerifyEmailEmail({ name, url }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Verificá tu email</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f5f5f5', padding: 24 }}>
        <Container style={{ backgroundColor: 'white', padding: 24, borderRadius: 8, maxWidth: 480 }}>
          <Heading>Verificá tu email</Heading>
          <Text>Hola{name ? ` ${name}` : ''},</Text>
          <Text>
            Para activar tu cuenta, hacé click en el botón de abajo. El link
            expira en 24 horas.
          </Text>
          <Section style={{ textAlign: 'center', padding: '16px 0' }}>
            <Button
              href={url}
              style={{
                backgroundColor: '#374151',
                color: 'white',
                padding: '12px 24px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              Verificar email
            </Button>
          </Section>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            ¿No funciona? Copiá este link: <Link href={url}>{url}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

### Task 13: Crear `ResetPasswordEmail` template

**Files:** `src/modules/auth/emails/ResetPasswordEmail.tsx` (crear)

- [ ] **Step 1: Crear el archivo**

```tsx
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components';

interface Props {
  name: string | null;
  url: string;
}

export function ResetPasswordEmail({ name, url }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Restablecé tu contraseña</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f5f5f5', padding: 24 }}>
        <Container style={{ backgroundColor: 'white', padding: 24, borderRadius: 8, maxWidth: 480 }}>
          <Heading>Restablecer contraseña</Heading>
          <Text>Hola{name ? ` ${name}` : ''},</Text>
          <Text>
            Recibimos un pedido para restablecer la contraseña. El link expira
            en 30 minutos.
          </Text>
          <Section style={{ textAlign: 'center', padding: '16px 0' }}>
            <Button
              href={url}
              style={{
                backgroundColor: '#374151',
                color: 'white',
                padding: '12px 24px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              Restablecer contraseña
            </Button>
          </Section>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            Si no pediste esto, ignorá este email. Tu contraseña actual sigue vigente.
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            ¿No funciona? Copiá: <Link href={url}>{url}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

### Task 14: Crear API route handler `app/api/auth/[...all]/route.ts`

**Files:** `src/app/api/auth/[...all]/route.ts` (crear)

- [ ] **Step 1: Crear el archivo**

```typescript
import { auth } from '@/shared/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
```

---

# FASE 4 — Páginas y formularios de Auth

### Task 15: Crear módulo sign-in (page + form + schema + index)

**Files:**
- `src/modules/auth/features/sign-in/SignInPage.tsx` (crear)
- `src/modules/auth/features/sign-in/components/_SignInForm.tsx` (crear)
- `src/modules/auth/features/sign-in/schema.ts` (crear)
- `src/modules/auth/features/sign-in/index.ts` (crear)

- [ ] **Step 1: schema.ts**

```typescript
import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Requerido'),
  rememberMe: z.boolean().default(true),
});

export type SignInInput = z.infer<typeof signInSchema>;
```

- [ ] **Step 2: SignInPage.tsx**

```tsx
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
```

- [ ] **Step 3: components/_SignInForm.tsx** (idéntico a ecokit, ver `C:\Users\Yorda\OneDrive\Desktop\Workspace\CodeControl\ecokit\src\modules\auth\features\sign-in\components\_SignInForm.tsx`)

Copiar literal el contenido del archivo de ecokit (172 líneas). Importa `authClient` de `@/shared/lib/auth-client`, usa `react-hook-form` + `zod`, traduce errores BA a español, soporta query param `?invitation=`, `?redirect=`, `?verify=pending`.

> Si no existe el componente `PasswordInput` en `src/shared/components/ui/password-input.tsx`, crearlo en una **sub-tarea inline** copiando del ecokit (es un wrapper simple sobre `<Input type={showPassword ? 'text' : 'password'} />` con un toggle). Verificar primero:
> ```bash
> ls src/shared/components/ui/password-input.tsx 2>/dev/null && echo "existe" || echo "falta"
> ```

- [ ] **Step 4: index.ts**

```typescript
export { SignInPage } from './SignInPage';
```

---

### Task 16: Crear módulo sign-up (page + form + schema + index)

**Files:**
- `src/modules/auth/features/sign-up/SignUpPage.tsx` (crear)
- `src/modules/auth/features/sign-up/components/_SignUpForm.tsx` (crear)
- `src/modules/auth/features/sign-up/schema.ts` (crear)
- `src/modules/auth/features/sign-up/index.ts` (crear)
- (`actions.server.ts` ya creado en Tarea 11)

- [ ] **Step 1: schema.ts**

```typescript
import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  firstName: z.string().min(1, 'Requerido').max(100),
  lastName: z.string().min(1, 'Requerido').max(100),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
```

- [ ] **Step 2: SignUpPage.tsx** (copiar literal de `ecokit/src/modules/auth/features/sign-up/SignUpPage.tsx`)

- [ ] **Step 3: components/_SignUpForm.tsx** (copiar literal de `ecokit/src/modules/auth/features/sign-up/components/_SignUpForm.tsx`)

> Cambiar el branding "Ecokit" → "Contable" en strings visibles si aparecen.

- [ ] **Step 4: index.ts**

```typescript
export { SignUpPage } from './SignUpPage';
```

---

### Task 17: Crear módulo reset-password

**Files:**
- `src/modules/auth/features/reset-password/ResetPasswordRequestPage.tsx`
- `src/modules/auth/features/reset-password/ResetPasswordConfirmPage.tsx`
- `src/modules/auth/features/reset-password/components/_ResetPasswordRequestForm.tsx`
- `src/modules/auth/features/reset-password/components/_ResetPasswordConfirmForm.tsx`
- `src/modules/auth/features/reset-password/schema.ts`
- `src/modules/auth/features/reset-password/index.ts`

- [ ] **Step 1-6: Copiar literal todos los archivos de** `ecokit/src/modules/auth/features/reset-password/` **al path análogo en contable**.

Archivos exactos en ecokit:
```
src/modules/auth/features/reset-password/ResetPasswordRequestPage.tsx
src/modules/auth/features/reset-password/ResetPasswordConfirmPage.tsx
src/modules/auth/features/reset-password/components/_ResetPasswordRequestForm.tsx
src/modules/auth/features/reset-password/components/_ResetPasswordConfirmForm.tsx
src/modules/auth/features/reset-password/schema.ts
src/modules/auth/features/reset-password/index.ts
```

Sin cambios — los archivos no tienen branding específico de ecokit.

---

### Task 18: Crear módulo verify-email

**Files:**
- `src/modules/auth/features/verify-email/VerifyEmailPage.tsx`
- `src/modules/auth/features/verify-email/index.ts`

- [ ] **Step 1: Copiar literal** `ecokit/src/modules/auth/features/verify-email/VerifyEmailPage.tsx` (60 líneas, sin branding).

- [ ] **Step 2: index.ts**

```typescript
export { VerifyEmailPage } from './VerifyEmailPage';
```

---

### Task 19: Reemplazar páginas catchall de Clerk por las nuevas

**Files:**
- ELIMINAR `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` (y su carpeta)
- ELIMINAR `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` (y su carpeta)
- CREAR `src/app/(auth)/sign-in/page.tsx`
- CREAR `src/app/(auth)/sign-up/page.tsx`

- [ ] **Step 1: Eliminar las carpetas catchall**

```bash
rm -rf "src/app/(auth)/sign-in/[[...sign-in]]"
rm -rf "src/app/(auth)/sign-up/[[...sign-up]]"
```

- [ ] **Step 2: Crear `src/app/(auth)/sign-in/page.tsx`**

```typescript
import { SignInPage } from '@/modules/auth/features/sign-in';

export default function Page() {
  return <SignInPage />;
}
```

- [ ] **Step 3: Crear `src/app/(auth)/sign-up/page.tsx`**

```typescript
import { SignUpPage } from '@/modules/auth/features/sign-up';
import { getInvitationByToken } from '@/modules/auth/features/accept-invitation/actions.server';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string; email?: string }>;
}) {
  const { invitation: token, email } = await searchParams;
  const invitation = token ? await getInvitationByToken(token) : null;
  return (
    <SignUpPage
      invitation={invitation}
      prefilledEmail={email ?? null}
      token={token ?? null}
    />
  );
}
```

---

### Task 20: Crear páginas reset-password y verify-email

**Files:**
- `src/app/(auth)/reset-password/page.tsx` (crear)
- `src/app/(auth)/verify-email/page.tsx` (crear)

- [ ] **Step 1: reset-password/page.tsx**

```typescript
import {
  ResetPasswordConfirmPage,
  ResetPasswordRequestPage,
} from '@/modules/auth/features/reset-password';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (token) {
    return <ResetPasswordConfirmPage token={token} />;
  }
  return <ResetPasswordRequestPage />;
}
```

- [ ] **Step 2: verify-email/page.tsx**

```typescript
import { Suspense } from 'react';
import { VerifyEmailPage } from '@/modules/auth/features/verify-email';

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailPage />
    </Suspense>
  );
}
```

---

### Task 21: Limpiar landing page (`src/app/page.tsx`)

**Files:** `src/app/page.tsx`

- [ ] **Step 1: Eliminar imports de `@clerk/nextjs` y reemplazar `SignedIn`/`SignedOut`/`SignInButton`/`SignUpButton`/`UserButton` por links a `/sign-in` y `/sign-up`**

Reemplazar las líneas 1-2 del archivo:

```typescript
// ANTES:
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

// DESPUÉS:
import { Suspense } from 'react';
import { auth } from '@/shared/lib/auth';
import { headers } from 'next/headers';
```

Y reemplazar todos los bloques `<SignedOut>...</SignedOut>` y `<SignedIn>...</SignedIn>` por una verificación SSR de la sesión:

```tsx
// Cambiar `export default function LandingPage()` a `export default async function LandingPage()` y al inicio:
const session = await auth.api.getSession({ headers: await headers() });
const isSignedIn = !!session;
```

Y dentro del JSX:
```tsx
{!isSignedIn ? (
  <>
    <Link href="/sign-in"><Button variant="ghost">Iniciar Sesión</Button></Link>
    <Link href="/sign-up"><Button>Comenzar<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
  </>
) : (
  <Link href="/dashboard"><Button variant="ghost">Dashboard</Button></Link>
)}
```

Aplicar el mismo patrón en los otros 2 bloques `<SignedOut>`/`<SignedIn>` del archivo (hero y CTA).

> Eliminar también el `<UserButton>` — no aplica en BA. El usuario va a verlo en el `_NavUser` del sidebar después de loguearse.

---

# FASE 5 — Middleware y Provider

### Task 22: Reescribir `src/proxy.ts` (BA en lugar de Clerk)

**Files:** `src/proxy.ts`

- [ ] **Step 1: Sobrescribir el archivo completo**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/shared/lib/auth';

const PUBLIC_PATHS = new Set([
  '/',
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/verify-email',
  '/invite',
]);

const PUBLIC_PREFIXES = [
  '/eq/',
  '/api/auth/',
  '/api/webhooks/',
  '/sign-in/',
  '/sign-up/',
  '/reset-password/',
  '/verify-email/',
  '/invite/',
];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    const url = new URL('/sign-in', req.url);
    if (path !== '/sign-in') url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

---

### Task 23: Reescribir `src/providers/SessionProvider.tsx` (pass-through)

**Files:** `src/providers/SessionProvider.tsx`

- [ ] **Step 1: Sobrescribir**

```typescript
'use client';

import type { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Pass-through. Better Auth no requiere provider — las cookies se manejan en server.
 * Mantenemos el componente para no romper el árbol del layout.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  return <>{children}</>;
}
```

---

# FASE 6 — Refactor masivo (Clerk → BA)

> A partir de este punto la app YA NO se ejecuta con Clerk. Todos los `auth()` y `clerkClient()` que sigan importando de `@clerk/nextjs/server` van a fallar al runtime. La estrategia es refactorizar **todos en bloque** y dejar al final la desinstalación. Si querés probar antes de terminar la Fase 6, podés ejecutar `npm run check-types` después de cada subtarea para ir cazando los pendientes.

### Task 24: Refactorizar `src/shared/lib/company.ts`

**Files:** `src/shared/lib/company.ts`

- [ ] **Step 1: Reemplazar el import de Clerk y los 4 `await auth()`**

```typescript
// ANTES (línea 5):
import { auth } from '@clerk/nextjs/server';

// DESPUÉS:
import { getCurrentUserId } from '@/shared/lib/current-user';
```

Y en cada función (líneas 14, 82, 208, 253) reemplazar:

```typescript
// ANTES:
const { userId } = await auth();
if (!userId) return null;

// DESPUÉS:
const userId = await getCurrentUserId();
if (!userId) return null;
```

(El comportamiento es equivalente — `getCurrentUserId()` devuelve `string | null`, y la firma de cada función no cambia.)

---

### Task 25: Refactorizar `src/shared/lib/permissions/audit.server.ts` y `getPermissions.server.ts`

**Files:**
- `src/shared/lib/permissions/audit.server.ts`
- `src/shared/lib/permissions/getPermissions.server.ts`

- [ ] **Step 1: En cada uno reemplazar import y `auth()`**

Mismo patrón que Tarea 24: import → `getCurrentUserId`, llamada → `const userId = await getCurrentUserId()`.

---

### Task 26: Refactorizar `src/shared/actions/table-preferences.ts`

**Files:** `src/shared/actions/table-preferences.ts`

- [ ] **Step 1: 3 ocurrencias de `auth()`** (líneas 19, 45, 78). Mismo patrón que Tarea 24.

---

### Task 27: Refactorizar `src/shared/components/layout/nav/_NavUser.tsx`

**Files:** `src/shared/components/layout/nav/_NavUser.tsx`

- [ ] **Step 1: Reemplazar `useUser/useClerk` por `authClient.useSession` y `authClient.signOut`**

```tsx
// ANTES:
import { useUser, useClerk } from '@clerk/nextjs';
// ...
const { user, isLoaded } = useUser();
const clerk = useClerk();
// ...
src={user?.imageUrl}
// ...
{user?.fullName || 'Usuario'}
// ...
{user?.primaryEmailAddress?.emailAddress || 'email@ejemplo.com'}
// ...
onClick={() => clerk.openUserProfile()}  // Cuenta
onClick={() => clerk.signOut({ redirectUrl: '/' })}  // Logout

// DESPUÉS:
import { useRouter } from 'next/navigation';
import { authClient } from '@/shared/lib/auth-client';
// ...
const router = useRouter();
const { data: session, isPending } = authClient.useSession();
const user = session?.user as
  | (typeof session.user & { firstName?: string | null; lastName?: string | null })
  | undefined;
const isLoaded = !isPending;
// imageUrl: usar el campo `image` o `imageUrl` que devuelve la sesión BA (si extendiste con imageKey, calcular URL)
// fullName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.name || 'Usuario'
// email: user?.email
// signOut:
onClick={() => {
  void authClient.signOut({
    fetchOptions: { onSuccess: () => router.push('/') },
  });
}}
// "Cuenta" - eliminar el item o redirigir a una página propia (no hay openUserProfile en BA).
// Recomendación: hacer el item "Cuenta" un link a /dashboard/profile (página por implementar) o quitar.
```

> El item "Cuenta" actualmente abre el modal de perfil de Clerk. BA no provee equivalente. Eliminar el item por ahora; queda como mejora futura.

---

### Task 28: Refactorizar accept-invitation actions y form

**Files:**
- `src/modules/auth/features/accept-invitation/actions.server.ts`
- `src/modules/auth/features/accept-invitation/components/_AcceptInvitationForm.tsx`

- [ ] **Step 1: actions.server.ts** — copiar literal de `ecokit/src/modules/auth/features/accept-invitation/actions.server.ts` (147 líneas). Reemplaza `auth()/clerkClient()` por `getCurrentUserId()/getCurrentUser()` y consulta `prisma.user` para obtener email del invitado en lugar de `clerk.users.getUser`.

- [ ] **Step 2: _AcceptInvitationForm.tsx** — copiar literal de `ecokit/src/modules/auth/features/accept-invitation/components/_AcceptInvitationForm.tsx` (281 líneas). Cambia `useUser/SignOutButton` por `authClient.useSession()/authClient.signOut()`.

---

### Task 29: Refactorizar `src/modules/company/features/general/users/actions.server.ts`

**Files:** `src/modules/company/features/general/users/actions.server.ts`

Esta es la refactorización más compleja porque depende fuerte de `clerkClient.users.getUser()` para enriquecer datos.

- [ ] **Step 1: Reemplazar imports**

```typescript
// ANTES:
import { auth, clerkClient } from '@clerk/nextjs/server';

// DESPUÉS:
import { getCurrentUserId } from '@/shared/lib/current-user';
```

- [ ] **Step 2: Reemplazar `clerk.users.getUser(member.userId)` por `prisma.user.findUnique`** en `getCompanyMembersPaginated`:

Líneas ~88-110:
```typescript
// ANTES (loop):
const clerk = await clerkClient();
const enrichedMembers = await Promise.all(
  members.map(async (member) => {
    try {
      const clerkUser = await clerk.users.getUser(member.userId);
      return {
        ...member,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? 'Sin email',
        firstName: clerkUser.firstName ?? '',
        lastName: clerkUser.lastName ?? '',
        imageUrl: clerkUser.imageUrl,
      };
    } catch { /* fallback */ }
  })
);

// DESPUÉS (batch):
const userIds = members.map((m) => m.userId);
const users = await prisma.user.findMany({
  where: { id: { in: userIds } },
  select: { id: true, email: true, firstName: true, lastName: true, imageUrl: true },
});
const userMap = new Map(users.map((u) => [u.id, u]));
const enrichedMembers = members.map((member) => {
  const u = userMap.get(member.userId);
  return {
    ...member,
    email: u?.email ?? 'Sin email',
    firstName: u?.firstName ?? '',
    lastName: u?.lastName ?? '',
    imageUrl: u?.imageUrl ?? null,
  };
});
```

- [ ] **Step 3: Reemplazar `clerk.users.getUserList({ emailAddress })` por `prisma.user.findUnique({ where: { email } })`** en `inviteUser`:

```typescript
// ANTES:
const existingUsers = await clerk.users.getUserList({
  emailAddress: [input.email.toLowerCase()],
});
if (existingUsers.data.length > 0) { ... existingUsers.data[0].id ... }

// DESPUÉS:
const existingUser = await prisma.user.findUnique({
  where: { email: input.email.toLowerCase() },
  select: { id: true },
});
if (existingUser) {
  const existingMember = await prisma.companyMember.findFirst({
    where: { companyId, userId: existingUser.id },
  });
  if (existingMember) {
    throw new Error('Este usuario ya es miembro de la empresa');
  }
}
```

- [ ] **Step 4: Reemplazar `clerk.users.getUser(userId)` para resolver inviter** en `inviteUser`:

```typescript
// ANTES:
const inviter = await clerk.users.getUser(userId);
const inviterName =
  `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || 'Un administrador';

// DESPUÉS:
const inviter = await prisma.user.findUnique({
  where: { id: userId },
  select: { firstName: true, lastName: true },
});
const inviterName =
  `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim() || 'Un administrador';
```

- [ ] **Step 5: Reemplazar todos los `await auth()` por `getCurrentUserId()`** en este archivo (4 ocurrencias).

---

### Task 30: Refactorizar `src/modules/company/features/general/users/UsersList.tsx`

**Files:** `src/modules/company/features/general/users/UsersList.tsx`

- [ ] **Step 1: Reemplazar import y `await auth()`**

```typescript
// ANTES:
import { auth } from '@clerk/nextjs/server';
// ...
const { userId } = await auth();

// DESPUÉS:
import { getCurrentUserId } from '@/shared/lib/current-user';
// ...
const userId = await getCurrentUserId();
```

---

### Task 31: Refactorizar `src/modules/company/features/general/audit/actions.server.ts`

**Files:** `src/modules/company/features/general/audit/actions.server.ts`

- [ ] **Step 1: Reemplazar el enrichment con clerkClient por prisma.user.findMany**

```typescript
// ANTES (líneas 58-80):
const userIds = [...new Set(logs.map((log) => log.performedBy))];
const clerk = await clerkClient();
const usersMap = new Map<string, ...>();
await Promise.all(userIds.map(async (userId) => {
  const user = await clerk.users.getUser(userId);
  usersMap.set(userId, { firstName: user.firstName ?? '', ... });
}));

// DESPUÉS:
const userIds = [...new Set(logs.map((log) => log.performedBy))];
const users = await prisma.user.findMany({
  where: { id: { in: userIds } },
  select: { id: true, firstName: true, lastName: true, imageUrl: true },
});
const usersMap = new Map<string, { firstName: string; lastName: string; imageUrl: string | null }>(
  users.map((u) => [u.id, {
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    imageUrl: u.imageUrl ?? null,
  }])
);
```

- [ ] **Step 2: Eliminar el import de `clerkClient`**

```typescript
// ANTES:
import { clerkClient } from '@clerk/nextjs/server';
// DESPUÉS: borrar la línea
```

---

### Task 32: Refactorizar todas las server actions con `auth()` (refactor en bloque)

**Files:** Esta tarea cubre los ~50 archivos restantes que tienen `import { auth } from '@clerk/nextjs/server';` y un `const { userId } = await auth();`.

Lista exhaustiva (de la Fase 0 de scope mapping):
```
src/modules/companies/features/create/actions.server.ts
src/modules/companies/features/list/actions.server.ts
src/modules/companies/features/detail/actions.server.ts
src/modules/companies/features/edit/actions.server.ts
src/modules/companies/shared/actions.server.ts
src/modules/company/features/general/roles/actions.server.ts
src/modules/dashboard/actions.server.ts
src/modules/equipment/features/depreciation/actions.server.ts
src/modules/documents/features/equipment-documents/upload/actions.server.ts
src/modules/documents/features/employee-documents/upload/actions.server.ts
src/modules/documents/features/company-documents/upload/actions.server.ts
src/modules/commercial/shared/actions/document-attachment.server.ts
src/modules/commercial/features/expenses/actions.server.ts
src/modules/commercial/features/expenses/attachment-actions.server.ts
src/modules/commercial/features/quotes/list/actions.server.ts
src/modules/commercial/features/account-balances/actions.server.ts
src/modules/commercial/features/products/features/list/actions.server.ts
src/modules/commercial/features/products/features/categories/list/actions.server.ts
src/modules/commercial/features/products/features/categories/actions.server.ts
src/modules/commercial/features/products/features/price-lists/list/actions.server.ts
src/modules/commercial/features/suppliers/features/list/actions.server.ts
src/modules/commercial/features/suppliers/features/detail/actions.server.ts
src/modules/commercial/features/sales/features/reports/actions.server.ts
src/modules/commercial/features/sales/features/points-of-sale/list/actions.server.ts
src/modules/commercial/features/sales/features/invoices/list/actions.server.ts
src/modules/commercial/features/sales/features/invoices/create/helpers.server.ts
src/modules/commercial/features/sales/features/delivery-notes/list/actions.server.ts
src/modules/commercial/features/purchases/features/reports/actions.server.ts
src/modules/commercial/features/purchases/features/invoices/list/actions.server.ts
src/modules/commercial/features/purchases/features/invoices/list/lib/afip-import.server.ts
src/modules/commercial/features/purchases/features/purchase-orders/list/actions.server.ts
src/modules/commercial/features/purchases/features/receiving-notes/list/actions.server.ts
src/modules/commercial/features/treasury/features/sessions/actions.server.ts
src/modules/commercial/features/treasury/features/receipts/actions.server.ts
src/modules/commercial/features/treasury/features/movements/actions.server.ts
src/modules/commercial/features/treasury/features/payment-orders/actions.server.ts
src/modules/commercial/features/treasury/features/checks/actions.server.ts
src/modules/commercial/features/treasury/features/cashflow/actions.server.ts
src/modules/commercial/features/treasury/features/cashflow-projections/actions.server.ts
src/modules/commercial/features/treasury/features/cash-registers/actions.server.ts
src/modules/commercial/features/treasury/features/bank-movements/actions.server.ts
src/modules/commercial/features/treasury/features/bank-movements/lib/import-export.server.ts
src/modules/commercial/features/treasury/features/bank-accounts/actions.server.ts
src/modules/commercial/features/warehouses/features/list/actions.server.ts
src/modules/commercial/features/warehouses/features/movements/actions.server.ts
src/modules/accounting/features/accounts/actions.server.ts
src/modules/accounting/features/accounts/lib/import-export.server.ts
src/modules/accounting/features/budgets/actions.server.ts
src/modules/accounting/features/entries/actions.server.ts
src/modules/accounting/features/fiscal-year-close/actions.server.ts
src/modules/accounting/features/opening-balances/actions.server.ts
src/modules/accounting/features/recurring-entries/actions.server.ts
src/modules/accounting/features/reports/actions.server.ts
src/modules/accounting/features/settings/actions.server.ts
```

PDF API routes:
```
src/app/api/invoices/[id]/pdf/route.ts
src/app/api/quotes/[id]/pdf/route.ts
src/app/api/receipts/[id]/pdf/route.ts
src/app/api/delivery-notes/[id]/pdf/route.ts
src/app/api/purchase-orders/[id]/pdf/route.ts
src/app/api/purchase-invoices/[id]/pdf/route.ts
src/app/api/payment-orders/[id]/pdf/route.ts
src/app/api/receiving-notes/[id]/pdf/route.ts
src/app/api/stock-transfers/[id]/pdf/route.ts
```

- [ ] **Step 1: En CADA archivo de la lista, hacer este refactor exacto**

Reemplazar:
```typescript
import { auth } from '@clerk/nextjs/server';
```
con:
```typescript
import { getCurrentUserId } from '@/shared/lib/current-user';
```

Y reemplazar:
```typescript
const { userId } = await auth();
```
con:
```typescript
const userId = await getCurrentUserId();
```

> Si en un archivo hay variables locales llamadas `userId` que conflictan, renombrar la del helper a `currentUserId`. La gran mayoría no tiene conflicto.

- [ ] **Step 2: Verificar que ningún archivo de las listas anteriores siga importando de `@clerk/nextjs/server`**

```bash
grep -rn "@clerk/nextjs" src/ --include="*.ts" --include="*.tsx"
```
Esperado: vacío. Si aparece algo, refactorizar ese archivo con el mismo patrón.

- [ ] **Step 3: Validar tipos**

```bash
npm run check-types
```
Esperado: SIN errores. Si hay errores, leer cada uno y arreglar (típicamente: imports residuales, tipos `User` mal usados, etc.).

---

# FASE 7 — Onboarding wizard

### Task 33: Crear módulo onboarding (8 archivos)

**Files:**
- `src/modules/onboarding/features/company-setup/OnboardingGate.tsx`
- `src/modules/onboarding/features/company-setup/actions.server.ts`
- `src/modules/onboarding/features/company-setup/schema.ts`
- `src/modules/onboarding/features/company-setup/index.ts`
- `src/modules/onboarding/features/company-setup/components/_OnboardingDialog.tsx`
- `src/modules/onboarding/features/company-setup/components/_StepIndicator.tsx`
- `src/modules/onboarding/features/company-setup/components/_ProgressDots.tsx`
- `src/modules/onboarding/features/company-setup/components/_StepIdentity.tsx`
- `src/modules/onboarding/features/company-setup/components/_StepFiscal.tsx`
- `src/modules/onboarding/features/company-setup/components/_StepContact.tsx`
- `src/modules/onboarding/features/company-setup/components/_StepBranding.tsx`
- `src/modules/onboarding/features/company-setup/components/_StepHeader.tsx`

- [ ] **Step 1: Copiar literal todos los archivos de** `ecokit/src/modules/onboarding/features/company-setup/` **al path análogo en contable**.

- [ ] **Step 2: Adaptar `_StepFiscal.tsx`** — el campo `taxpayerType` en ecokit no existe en contable. En contable es `taxStatus` (enum `TaxStatus { RESPONSABLE_INSCRIPTO, MONOTRIBUTO, EXENTO }`). Cambiar:
  - Schema: `taxpayerType` → `taxStatus`
  - Step component: select con las 3 opciones del enum
  - actions.server.ts: setear `taxStatus` no `taxpayerType`

- [ ] **Step 3: Adaptar `actions.server.ts`** — eliminar todos los campos que NO existan en `Company` de contable. Comparar con el modelo `Company` (líneas 77-130 del schema). Campos que sí existen: `name, taxId, taxStatus, description, email, phone, country, address, logoUrl, provinceId, cityId, industry`. Campo `logoKey` NO existe — se necesita agregarlo en una migración mínima o usar solo `logoUrl`.

  - Decisión: usar solo `logoUrl` por ahora (sin agregar `logoKey`), simplifica la integración con upload.

- [ ] **Step 4: Adaptar `index.ts`** del feature:

```typescript
export { OnboardingGate } from './OnboardingGate';
```

---

### Task 34: Integrar OnboardingGate en `(core)/layout.tsx`

**Files:** `src/app/(core)/layout.tsx`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat "src/app/(core)/layout.tsx"
```

- [ ] **Step 2: Importar OnboardingGate y renderizarlo dentro del `DashboardLayout`** (igual que ecokit, ver `ecokit/src/app/(core)/layout.tsx` línea 36).

```tsx
import { OnboardingGate } from '@/modules/onboarding/features/company-setup';
// ...
return (
  <DashboardLayout {...props}>
    {children}
    <OnboardingGate />
  </DashboardLayout>
);
```

---

### Task 35: Adaptar NoCompanyFallback para invitación pendiente

**Files:** `src/modules/companies/features/create/components/NoCompanyFallback.tsx` (verificar nombre exacto)

- [ ] **Step 1: Localizar el archivo en contable**

```bash
grep -rln "NoCompanyFallback" src/modules/companies/
```

- [ ] **Step 2: Copiar la lógica de detección de invitación pendiente** del archivo análogo en ecokit (`ecokit/src/modules/companies/features/create/components/NoCompanyFallback.tsx`). Si el archivo en contable difiere mucho del de ecokit, hacer un merge manual: agregar el bloque que consulta `prisma.companyInvitation.findFirst({ where: { email: currentUser.email, acceptedAt: null, expiresAt: { gt: new Date() } } })` y renderiza un CTA "Aceptar invitación" cuando hay match.

---

# FASE 8 — Import de usuarios desde Clerk

### Task 36: Crear `scripts/import-clerk-users.ts`

**Files:** `scripts/import-clerk-users.ts` (crear)

- [ ] **Step 1: Copiar literal de `ecokit/scripts/import-clerk-users.ts`** (146 líneas, sin cambios).

---

### Task 37: Crear migración SQL para importar usuarios de Clerk + reescribir FKs

**Files:** `prisma/migrations/<TS>_import_clerk_users_and_rewrite_fks/migration.sql`

> **Pre-requisito:** El CSV está en `C:\Users\Yorda\Downloads\ins_38P6vmH6shySwg2X3J1xoe3hSws.csv`. Tiene 6 usuarios (los mismos que ecokit, es la misma instancia Clerk):
> - `user_38XttXTm0XNDYKYMkyCUCgSnNjI` Yordani Testing — yordanpz+clerk_test@hotmail.com (verified)
> - `user_38ynF7pWZoKv2656xio53PsuMyB` Fabricio Spiritosi — fspiritosi@codecontrol.com.ar (verified)
> - `user_393PJBcgxiMmU5YW5f8pq7ysJ9e` Yordani 2 Jimenez 2 — yordani12yorda@gmail.com (verified)
> - `user_39uOjCvMT3YtyLB7EpXvosaeCZp` Fabricio Test — fspiritosi+clerk_test@codecontrol.com.ar (verified)
> - `user_3B7Y5ZOrDVsaBX61URxmrWtOOzX` Ecotest Ecokit — ventas@codecontrol.com.ar (verified)
> - `user_3D1w311vymgayazKMh33xayej7A` Rocio Alonso — ra@ecokit.com.ar (UN-verified en Clerk, pero el equipo confirma cuenta válida → marcar verified=true en migración)
>
> Hashes y fechas exactas en el CSV. Formato: `id, first_name, last_name, username, primary_email_address, verified_email_addresses, password_digest, password_hasher, totp_secret, created_at`.

- [ ] **Step 1: Generar la migración vacía**

```bash
npm run db:migrate -- --name import_clerk_users_and_rewrite_fks --create-only
```

- [ ] **Step 2: Sobrescribir el `migration.sql` generado**

Construir el SQL en dos partes:

**Parte A: insertar usuarios + accounts** — el usuario debe pasar el CSV o las filas. Patrón de ecokit (`ecokit/prisma/migrations/20260502010000_import_clerk_users_and_rewrite_fks/migration.sql`):

```sql
-- Migración: Importar usuarios de Clerk a Better Auth + reescribir FKs (idempotente)

-- 1. INSERTAR USUARIOS BA
INSERT INTO "user" (id, email, email_verified, name, image, created_at, updated_at, first_name, last_name, image_key, legacy_clerk_id)
VALUES
  -- USUARIO 1: reemplazar con datos del CSV
  (gen_random_uuid(), '<email>', <true|false>, '<full name>', NULL, '<clerk created_at iso>', NOW(), '<first>', '<last>', NULL, '<clerk_user_id>'),
  -- ... más filas ...
ON CONFLICT (email) DO UPDATE
  SET legacy_clerk_id = EXCLUDED.legacy_clerk_id
  WHERE "user".legacy_clerk_id IS NULL;

-- 2. INSERTAR ACCOUNTS (credentials con bcrypt password_digest)
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT gen_random_uuid(), u.id::text, 'credential', u.id, x.password, NOW(), NOW()
FROM (VALUES
  ('<clerk_user_id_1>', '<bcrypt_hash_1>'),
  -- ... más filas ...
) AS x(clerk_id, password)
JOIN "user" u ON u.legacy_clerk_id = x.clerk_id
WHERE NOT EXISTS (
  SELECT 1 FROM account a
  WHERE a.user_id = u.id AND a.provider_id = 'credential'
);
```

**Parte B: rewrites de FKs string** — para contable, las columnas que guardan Clerk userId como string son:
- `company_members.user_id`
- `company_members.invited_by`
- `company_invitations.invited_by`
- `user_preferences.user_id`
- `company_member_permissions.assigned_by`
- `permission_audit_logs.performed_by`
- Todas las columnas `created_by`, `updated_by`, `uploaded_by`, `changed_by`, `approved_by`, `posted_by`, `reversed_by`, `assigned_by` en los modelos enumerados (~40 columnas string en distintas tablas)

Para cada una, agregar al SQL:

```sql
-- Rewrite company_members.user_id (string Clerk → string UUID BA)
UPDATE company_members cm
SET user_id = u.id::text
FROM "user" u
WHERE cm.user_id = u.legacy_clerk_id;

UPDATE company_members cm
SET invited_by = u.id::text
FROM "user" u
WHERE cm.invited_by = u.legacy_clerk_id;

UPDATE company_invitations ci
SET invited_by = u.id::text
FROM "user" u
WHERE ci.invited_by = u.legacy_clerk_id;

UPDATE user_preferences up
SET user_id = u.id::text
FROM "user" u
WHERE up.user_id = u.legacy_clerk_id;

UPDATE company_member_permissions cmp
SET assigned_by = u.id::text
FROM "user" u
WHERE cmp.assigned_by = u.legacy_clerk_id;

UPDATE permission_audit_logs pal
SET performed_by = u.id::text
FROM "user" u
WHERE pal.performed_by = u.legacy_clerk_id;
```

Y para columnas `created_by`/`approved_by`/etc en tablas variadas (consultar grep de la Tarea 0 mapping), generar UPDATEs análogos para cada tabla. Por brevedad — y porque son string nullable o con default `""` —, NO hace falta convertir a UUID, solo reescribir el valor:

```sql
-- Generic pattern: para cada tabla T y columna C:
UPDATE <table> t
SET <column> = u.id::text
FROM "user" u
WHERE t.<column> = u.legacy_clerk_id;
```

Tablas afectadas (string columnas con Clerk IDs):
```
journal_entries.created_by, journal_entries.reversed_by
journal_entry_lines (no tiene)
budgets.created_by
budget_revisions.created_by
employee_documents.uploaded_by
employee_document_history.changed_by
equipment_documents.uploaded_by, equipment_documents.approved_by
equipment_document_history.changed_by
company_documents.created_by, company_documents.uploaded_by, company_documents.approved_by
quotes.created_by
quote_lines (no tiene)
sales_invoices.created_by
purchase_invoices.created_by
cash_register_sessions.created_by
cash_movements.created_by
bank_movements.created_by
receipts.created_by
payment_orders.created_by
expenses.created_by
expense_attachments.created_by
purchase_orders.created_by, purchase_orders.approved_by
receiving_notes.created_by
delivery_notes.created_by
checks.created_by
recurring_entries.created_by
cashflow_projections.created_by, cashflow_projections.posted_by
projection_document_links.created_by
vehicle_depreciations.created_by
asset_value_adjustments.created_by
sales_credit_note_applications.created_by
purchase_credit_note_applications.created_by
stock_transfers.created_by
stock_movements.created_by
```

Para cada una:
```sql
UPDATE <tabla> SET <columna> = u.id::text FROM "user" u WHERE <tabla>.<columna> = u.legacy_clerk_id;
```

> **Atajo automático**: en lugar de listar todos manualmente, podés generar el script con un grep en el schema:
> ```bash
> grep -E '@map\("(created_by|approved_by|reversed_by|posted_by|uploaded_by|changed_by|assigned_by)"\)' prisma/schema.prisma
> ```
> y mapear cada línea a la tabla correspondiente con el contexto del modelo.

- [ ] **Step 3: Aplicar la migración**

```bash
npm run db:migrate -- --name import_clerk_users_and_rewrite_fks
```
Esperado: sin error. Los 6+ usuarios deben aparecer en la tabla `user` y sus credenciales en `account`.

- [ ] **Step 4: Smoke test del login con un usuario importado**

```bash
npm run dev
```
Abrir `http://localhost:3001/sign-in`, intentar loguear con un email + password de Clerk previo. Debe funcionar — `auth.tsx.password.verify` detecta el bcrypt hash y compara con bcrypt.

---

# FASE 9 — Cleanup y validación

### Task 38: Desinstalar paquetes de Clerk

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Verificar que NO quedan imports de `@clerk/*`**

```bash
grep -rn "@clerk/" src/
```
Esperado: vacío. Si aparece, refactorizar antes de continuar.

- [ ] **Step 2: Desinstalar**

```bash
npm uninstall @clerk/nextjs @clerk/localizations @clerk/themes @clerk/testing
```

- [ ] **Step 3: Verificar que el árbol queda limpio**

```bash
npm run check-types
npm run lint
```
Esperado: SIN errores.

---

### Task 39: Quitar variables CLERK_* de los .env

**Files:** `.env.production`, `.env`

- [ ] **Step 1: Editar `.env.production`** — eliminar la línea `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...`. Mantener `NEXT_PUBLIC_APP_URL`.

- [ ] **Step 2: Editar `.env`** — eliminar manualmente las claves CLERK_*, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_*, etc. (lo hace el usuario, no el agente).

---

### Task 40: Validación final completa

- [ ] **Step 1: Build limpio**

```bash
npm run build
```
Esperado: build exitoso, sin warnings de Clerk.

- [ ] **Step 2: Suite de Cypress básica**

```bash
npm run cy:run:auth
```
Esperado: tests de auth pasan (probablemente requieran ajustes — los specs de Cypress que tocan Clerk hay que actualizar).

- [ ] **Step 3: Smoke test manual end-to-end**

Validar:
- Sign-up con email nuevo → email de verificación llega → click verifica → redirige a /dashboard
- Sign-in con usuario importado (email + password Clerk) → entra OK
- Reset password → email llega → form pide nueva password → login con la nueva pass funciona
- Invitación: admin invita → email llega → link → sign-up + verify → /invite acepta y entra a la company
- Sign-out → vuelve a `/`
- Onboarding: nuevo signup que crea su primera company → wizard mandatorio aparece
- Sidebar: foto/nombre/email del usuario aparecen en `_NavUser` correctamente
- DataTable de usuarios: muestra todos los miembros con nombre y avatar correctos
- Audit log: muestra "performed by" con el nombre real (no UUID)

---

## Self-Review Notes

- **Conflicto Account**: resuelto con `BetterAuthAccount @@map("account")`. La tabla DB es `account` (singular), el modelo Prisma del plan contable sigue siendo `Account` mapeado a `accounts` (plural) — sin colisión.
- **Sin baseline**: contable no tiene baseline migration. Las 4 nuevas migraciones de BA son independientes y se aplican sobre el estado actual de la DB. El fallback es `prisma db push` si `migrate dev` falla por estado inconsistente.
- **Resend → Nodemailer**: la migración del transporte se hace ANTES de configurar BA porque BA depende de `sendEmail`. Resend queda desinstalable después si nada más lo usa (verificar `grep -rn "from 'resend'" src/` antes de quitar).
- **PDF API routes**: las 9 routes de PDF usan `auth()` solo para verificar que hay sesión. Reemplazar por `getCurrentUserId()` y devolver 401 si null. Si alguna usa `userId` para algo más que verificar autenticación, refactorizar también esa parte.
- **CSV de Clerk**: el plan asume que el usuario provee el archivo `exported_users.csv` antes de la Tarea 37. Sin él, el SQL de import no se puede generar. Se le va a pedir explícitamente al iniciar la Fase 8.
- **Riesgo de tipos**: `getCurrentUserId()` devuelve `string | null`. El código viejo de Clerk también devolvía `string | null` (vía destructuring de `auth()`), así que el contrato es idéntico — no hay cambios de tipo en los call sites.
- **Backwards compatibility**: el campo `legacy_clerk_id` queda guardado en `User` como referencia. Una vez verificada la migración en prod por unos días, se puede dropear en una limpieza posterior.
