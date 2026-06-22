import { z } from 'zod';
import { PartnerMovementType } from '@/generated/prisma/enums';

export const partnerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  taxId: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

/**
 * Tipos de movimiento que el usuario puede registrar manualmente.
 * OWED se genera automáticamente al pagar con la tarjeta del socio (otra fase),
 * por lo que NO se permite desde este formulario.
 */
export const MANUAL_MOVEMENT_TYPES = [
  PartnerMovementType.REPAYMENT,
  PartnerMovementType.ADJUSTMENT,
] as const;

export const partnerMovementSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  type: z.enum([PartnerMovementType.REPAYMENT, PartnerMovementType.ADJUSTMENT], {
    message: 'Tipo de movimiento inválido',
  }),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  description: z.string().min(1, 'La descripción es requerida').max(500),
});

export type PartnerFormData = z.infer<typeof partnerSchema>;
export type PartnerMovementFormData = z.infer<typeof partnerMovementSchema>;
