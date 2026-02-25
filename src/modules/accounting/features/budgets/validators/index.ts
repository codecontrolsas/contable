import { z } from 'zod';

/**
 * Schema para crear un presupuesto.
 * monthlyAmounts: array de exactamente 12 números >= 0.
 */
export const createBudgetSchema = z.object({
  accountId: z.string().uuid('La cuenta es requerida'),
  fiscalYear: z.number().int().min(2000).max(2100),
  monthlyAmounts: z
    .array(z.number().min(0, 'El monto debe ser >= 0'))
    .length(12, 'Debe tener exactamente 12 montos mensuales'),
  notes: z.string().max(500).optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

/**
 * Schema para actualizar un presupuesto DRAFT.
 * Permite actualizar montos y notas.
 */
export const updateBudgetSchema = z.object({
  monthlyAmounts: z
    .array(z.number().min(0, 'El monto debe ser >= 0'))
    .length(12, 'Debe tener exactamente 12 montos mensuales'),
  notes: z.string().max(500).optional(),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

/**
 * Schema para crear una revisión de presupuesto ACTIVE.
 * Requiere nuevos montos y motivo obligatorio.
 */
export const createRevisionSchema = z.object({
  budgetId: z.string().uuid('El presupuesto es requerido'),
  newAmounts: z
    .array(z.number().min(0, 'El monto debe ser >= 0'))
    .length(12, 'Debe tener exactamente 12 montos mensuales'),
  reason: z.string().min(1, 'El motivo es obligatorio').max(500),
});

export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
