import { z } from 'zod';
import { VoucherType } from '@/generated/prisma/enums';

// ============================================
// Part A: Asiento de Apertura
// ============================================

export const accountBalanceLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0, 'El monto debe ser positivo'),
  credit: z.number().min(0, 'El monto debe ser positivo'),
});

export const openingBalanceFormSchema = z.object({
  balances: z
    .array(accountBalanceLineSchema)
    .min(1, 'Debe ingresar al menos un saldo'),
});

export type OpeningBalanceFormInput = z.infer<typeof openingBalanceFormSchema>;
export type AccountBalanceLineInput = z.infer<typeof accountBalanceLineSchema>;

// ============================================
// Part B: Facturas de Apertura
// ============================================

export const openingSalesInvoiceSchema = z.object({
  customerId: z.string().uuid('Seleccioná un cliente'),
  pointOfSaleId: z.string().uuid('Seleccioná un punto de venta'),
  voucherType: z.nativeEnum(VoucherType),
  number: z.string().min(1, 'El número es requerido'),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  total: z.number().positive('El total debe ser mayor a 0'),
});

export type OpeningSalesInvoiceInput = z.infer<typeof openingSalesInvoiceSchema>;

export const openingPurchaseInvoiceSchema = z.object({
  supplierId: z.string().uuid('Seleccioná un proveedor'),
  voucherType: z.nativeEnum(VoucherType),
  pointOfSale: z.string().min(1, 'El punto de venta es requerido'),
  number: z.string().min(1, 'El número es requerido'),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  total: z.number().positive('El total debe ser mayor a 0'),
});

export type OpeningPurchaseInvoiceInput = z.infer<typeof openingPurchaseInvoiceSchema>;
