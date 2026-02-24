import { z } from 'zod';

export const depreciationConfigSchema = z
  .object({
    method: z.enum(['STRAIGHT_LINE', 'DECLINING_BALANCE']),
    grossValue: z.coerce.number().positive('El valor de origen debe ser mayor a 0'),
    salvageValue: z.coerce.number().min(0, 'El valor residual no puede ser negativo'),
    usefulLifeMonths: z.coerce
      .number()
      .int()
      .min(1, 'La vida útil debe ser al menos 1 mes')
      .max(600, 'La vida útil no puede superar 50 años'),
    startDate: z.coerce.date({ required_error: 'La fecha de inicio es requerida' }),
    depreciationRate: z.coerce
      .number()
      .min(0.01, 'La tasa debe ser mayor a 0')
      .max(100, 'La tasa no puede superar 100%')
      .optional()
      .nullable(),
  })
  .refine((data) => data.salvageValue < data.grossValue, {
    message: 'El valor residual debe ser menor al valor de origen',
    path: ['salvageValue'],
  })
  .refine(
    (data) => {
      if (data.method === 'DECLINING_BALANCE') {
        return data.depreciationRate != null && data.depreciationRate > 0;
      }
      return true;
    },
    {
      message: 'La tasa de depreciación es requerida para el método de saldo decreciente',
      path: ['depreciationRate'],
    },
  );

export type DepreciationConfigInput = z.infer<typeof depreciationConfigSchema>;

export const valueAdjustmentSchema = z.object({
  date: z.coerce.date({ required_error: 'La fecha es requerida' }),
  newValue: z.coerce.number().positive('El nuevo valor debe ser mayor a 0'),
  reason: z.string().min(1, 'El motivo es requerido').max(500, 'El motivo es demasiado largo'),
});

export type ValueAdjustmentInput = z.infer<typeof valueAdjustmentSchema>;
