'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { CheckCircle } from 'lucide-react';
import { _AccountBalancesForm } from './_AccountBalancesForm';
import { _PendingSalesInvoicesTab } from './_PendingSalesInvoicesTab';
import { _PendingPurchasesTab } from './_PendingPurchasesTab';
import type { OpeningBalancesPageData } from '../types';

interface Props {
  data: OpeningBalancesPageData;
}

export function _OpeningBalancesTabs({ data }: Props) {
  return (
    <Tabs defaultValue="opening-entry">
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
        <TabsTrigger value="opening-entry" className="flex items-center gap-1">
          Asiento de Apertura
          {data.existingOpeningEntry && (
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          )}
        </TabsTrigger>
        <TabsTrigger value="sales-invoices">
          Facturas de Venta Pendientes
        </TabsTrigger>
        <TabsTrigger value="purchase-invoices">
          Facturas de Compra Pendientes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="opening-entry">
        <_AccountBalancesForm
          accounts={data.accounts}
          settings={data.settings!}
          existingEntry={data.existingOpeningEntry}
          aperturaAccount={data.aperturaAccount}
        />
      </TabsContent>

      <TabsContent value="sales-invoices">
        <_PendingSalesInvoicesTab
          contractors={data.contractors}
          pointsOfSale={data.pointsOfSale}
        />
      </TabsContent>

      <TabsContent value="purchase-invoices">
        <_PendingPurchasesTab suppliers={data.suppliers} />
      </TabsContent>
    </Tabs>
  );
}
