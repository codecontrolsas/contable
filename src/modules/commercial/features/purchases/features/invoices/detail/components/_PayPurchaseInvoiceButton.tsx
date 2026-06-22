'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { CreatePaymentOrderModal } from '@/modules/commercial/features/treasury/features/payment-orders/list/components/_CreatePaymentOrderModal';
import { isCreditNote } from '@/modules/commercial/shared/voucher-utils';

interface Props {
  invoiceId: string;
  supplierId: string;
  fullNumber: string;
  voucherType: string;
  total: number;
  paidAmount: number;
  pendingAmount: number;
}

/**
 * Botón "Pagar Factura" del detalle de factura de compra.
 * Reutiliza el modal único de Órdenes de Pago (CreatePaymentOrderModal) con la
 * factura precargada, de modo que la experiencia de pago es la misma en todos los
 * puntos de entrada (lista de OP, cuenta corriente del proveedor y este botón).
 */
export function _PayPurchaseInvoiceButton({
  invoiceId,
  supplierId,
  voucherType,
  pendingAmount,
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Las notas de crédito no se pagan; si no hay saldo pendiente, no se muestra el botón.
  if (isCreditNote(voucherType) || pendingAmount <= 0) return null;

  const handleSuccess = () => {
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ['paymentOrders'] });
    queryClient.invalidateQueries({ queryKey: ['pendingPurchaseInvoices'] });
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CreditCard className="mr-2 h-4 w-4" />
        Pagar Factura
      </Button>

      <CreatePaymentOrderModal
        prefilledSupplierId={supplierId}
        prefilledInvoices={[{ id: invoiceId, pendingAmount }]}
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
