import { z } from 'zod';
import { TaxStatus } from '@/generated/prisma/enums';

export const onboardingSchema = z.object({
  // Step 1 — Identidad
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  industry: z.string().optional(),
  description: z.string().optional(),
  // Step 2 — Fiscal
  taxId: z.string().optional(),
  taxStatus: z.nativeEnum(TaxStatus).optional(),
  // Step 3 — Contacto y ubicación
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  country: z.string().optional(),
  provinceId: z.coerce.number().int().optional(),
  cityId: z.coerce.number().int().optional(),
  address: z.string().optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
