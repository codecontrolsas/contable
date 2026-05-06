import { SignUpPage } from '@/modules/auth/features/sign-up';
import { getInvitationByToken } from '@/modules/auth/features/accept-invitation/actions.server';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string; email?: string }>;
}) {
  const { invitation: token, email } = await searchParams;
  const invitation = token ? await getInvitationByToken(token) : null;
  return (
    <SignUpPage
      invitation={invitation}
      prefilledEmail={email ?? null}
      token={token ?? null}
    />
  );
}
