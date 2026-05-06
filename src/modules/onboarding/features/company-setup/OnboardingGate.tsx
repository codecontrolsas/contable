import { _OnboardingDialog } from './components/_OnboardingDialog';
import { getActiveCompany } from '@/shared/lib/company';

export async function OnboardingGate() {
  const company = await getActiveCompany();
  if (!company) return null;
  if (company.onboardingCompleted) return null;
  return (
    <_OnboardingDialog
      companyId={company.id}
      defaultName={company.name}
    />
  );
}
