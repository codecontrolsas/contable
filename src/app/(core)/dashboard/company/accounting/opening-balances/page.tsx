import { OpeningBalancesPage } from '@/modules/accounting/features/opening-balances';
import { checkPermission } from '@/shared/lib/permissions';

export default async function OpeningBalancesRoutePage() {
  await checkPermission('accounting.opening-balances', 'view');

  return <OpeningBalancesPage />;
}
