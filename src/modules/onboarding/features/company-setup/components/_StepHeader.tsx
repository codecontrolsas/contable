'use client';

interface Props {
  title: string;
  helper: string;
}

export function _StepHeader({ title, helper }: Props) {
  return (
    <div className="space-y-2 mb-8">
      <h2
        className="text-3xl tracking-tight"
        style={{ fontFamily: 'var(--font-display), serif', fontWeight: 500 }}
      >
        {title}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md">{helper}</p>
    </div>
  );
}
