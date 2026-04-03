'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';
import { Separator } from '@/shared/components/ui/separator';
import { logger } from '@/shared/lib/logger';
import { createCustomerFromLead } from '../../list/actions.server';

const TAX_CONDITION_LABELS: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTISTA: 'Monotributista',
  EXENTO: 'Exento',
  CONSUMIDOR_FINAL: 'Consumidor Final',
};

const leadToCustomerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  taxId: z.string().min(1, 'El CUIT es requerido'),
  taxCondition: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL']),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type FormValues = z.infer<typeof leadToCustomerSchema>;

interface Props {
  leadId: string;
  quoteId: string;
  leadData: {
    name: string;
    email: string;
    phone: string;
  };
  onSuccess: (customerId: string) => void;
  onCancel: () => void;
}

export function _LeadToCustomerForm({ leadId, quoteId, leadData, onSuccess, onCancel }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(leadToCustomerSchema),
    defaultValues: {
      name: leadData.name,
      taxId: '',
      taxCondition: 'CONSUMIDOR_FINAL',
      email: leadData.email || '',
      phone: leadData.phone || '',
      address: '',
    },
  });

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const result = await createCustomerFromLead(leadId, quoteId, {
        name: values.name,
        taxId: values.taxId,
        taxCondition: values.taxCondition,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
      });

      toast.success('Cliente creado exitosamente');
      onSuccess(result.customerId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear el cliente';
      toast.error(message);
      logger.error('Error al crear cliente desde lead', { data: { leadId, quoteId, error: err } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserPlus className="h-4 w-4" />
        <span>
          El presupuesto está asociado a un lead. Para generar una factura, primero debés crear el cliente.
        </span>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre / Razón Social</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nombre del cliente" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CUIT</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="20-12345678-9" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taxCondition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condición Fiscal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar condición" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(TAX_CONDITION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="email@ejemplo.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="+54 9 ..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Dirección" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Volver
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cliente...
                </>
              ) : (
                'Crear Cliente y Continuar'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
