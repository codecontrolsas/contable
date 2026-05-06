import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Requerido'),
  rememberMe: z.boolean().default(true),
});

export type SignInInput = z.infer<typeof signInSchema>;
