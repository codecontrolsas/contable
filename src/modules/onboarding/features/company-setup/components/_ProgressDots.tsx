'use client';

import { cn } from '@/shared/lib/utils';

interface Props {
  current: 1 | 2 | 3 | 4;
}

export function _ProgressDots({ current }: Props) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4].map((step) => {
        const state = step < current ? 'past' : step === current ? 'current' : 'future';
        return (
          <span
            key={step}
            className={cn(
              'h-[2px] rounded-full transition-all duration-500',
              state === 'current' && 'w-12 bg-foreground',
              state === 'past' && 'w-6 bg-foreground/60',
              state === 'future' && 'w-6 bg-foreground/15',
            )}
          />
        );
      })}
    </div>
  );
}
