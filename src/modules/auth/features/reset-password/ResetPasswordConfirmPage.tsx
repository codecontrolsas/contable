import { _ResetPasswordConfirmForm } from './components/_ResetPasswordConfirmForm';

interface Props {
  token: string;
}

export function ResetPasswordConfirmPage({ token }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Nueva contraseña</h1>
        </div>
        <_ResetPasswordConfirmForm token={token} />
      </div>
    </div>
  );
}
