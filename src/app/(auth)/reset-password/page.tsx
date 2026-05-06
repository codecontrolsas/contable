import {
  ResetPasswordConfirmPage,
  ResetPasswordRequestPage,
} from '@/modules/auth/features/reset-password';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (token) {
    return <ResetPasswordConfirmPage token={token} />;
  }
  return <ResetPasswordRequestPage />;
}
