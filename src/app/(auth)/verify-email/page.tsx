import { Suspense } from 'react';
import { VerifyEmailPage } from '@/modules/auth/features/verify-email';

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailPage />
    </Suspense>
  );
}
