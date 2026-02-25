import { BudgetsPage } from '@/modules/accounting/features/budgets';
import { checkPermission } from '@/shared/lib/permissions';

export default async function BudgetsRoutePage() {
  await checkPermission('accounting.budgets', 'view');

  return <BudgetsPage />;
}
