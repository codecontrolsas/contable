import { z } from 'zod';
import { CardType, CardOwnerType } from '@/generated/prisma/enums';

export const cardSchema = z
  .object({
    name: z.string().min(1, 'El alias es requerido').max(100),
    cardType: z.nativeEnum(CardType),
    brand: z.string().max(50).optional().or(z.literal('')),
    lastFour: z
      .string()
      .regex(/^\d{4}$/, 'Deben ser 4 dígitos')
      .optional()
      .or(z.literal('')),
    ownerType: z.nativeEnum(CardOwnerType),
    partnerId: z.string().uuid('Socio inválido').optional().or(z.literal('')),
    creditLimit: z.coerce.number().min(0).optional(),
    closingDay: z.coerce.number().int().min(1, 'Día entre 1 y 31').max(31, 'Día entre 1 y 31').optional(),
    dueDay: z.coerce.number().int().min(1, 'Día entre 1 y 31').max(31, 'Día entre 1 y 31').optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => data.ownerType !== CardOwnerType.PARTNER || (!!data.partnerId && data.partnerId !== ''),
    {
      message: 'Debe seleccionar el socio titular',
      path: ['partnerId'],
    }
  )
  .refine((data) => data.cardType === CardType.CREDIT || data.creditLimit === undefined, {
    message: 'El límite de crédito solo aplica a tarjetas de crédito',
    path: ['creditLimit'],
  })
  .refine((data) => data.cardType === CardType.CREDIT || data.closingDay === undefined, {
    message: 'El día de cierre solo aplica a tarjetas de crédito',
    path: ['closingDay'],
  })
  .refine((data) => data.cardType === CardType.CREDIT || data.dueDay === undefined, {
    message: 'El día de vencimiento solo aplica a tarjetas de crédito',
    path: ['dueDay'],
  });

export type CardFormData = z.infer<typeof cardSchema>;
