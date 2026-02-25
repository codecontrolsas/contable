import { Suspense } from 'react';

import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getCashRegisters } from './actions.server';
import { _CashRegistersListContent } from './components/_CashRegistersListContent';

export async function CashRegistersList() {
  const cashRegisters = await getCashRegisters();

  return (
    <PermissionGuard module="commercial.treasury.cash-registers" action="view" redirect>
    <Suspense fallback={<div>Cargando...</div>}>
      <_CashRegistersListContent initialData={cashRegisters} />
    </Suspense>
    </PermissionGuard>
  );
}
