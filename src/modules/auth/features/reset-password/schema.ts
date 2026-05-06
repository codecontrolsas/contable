import { z } from 'zod';

export const requestSchema = z.object({
  email: z.string().email('Email inválido'),
});
export type RequestInput = z.infer<typeof requestSchema>;

export const confirmSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener una mayúscula')
      .regex(/[0-9]/, 'Debe contener un número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });
export type ConfirmInput = z.infer<typeof confirmSchema>;
