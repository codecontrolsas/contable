'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/components/ui/input';

export interface PasswordInputProps
  extends Omit<React.ComponentProps<'input'>, 'type'> {
  /** Texto accesible para el botón de toggle. */
  toggleAriaLabel?: {
    show?: string;
    hide?: string;
  };
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, toggleAriaLabel, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const showLabel = toggleAriaLabel?.show ?? 'Mostrar contraseña';
    const hideLabel = toggleAriaLabel?.hide ?? 'Ocultar contraseña';

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-center px-3',
            'text-muted-foreground hover:text-foreground transition-colors',
            'focus:outline-none focus-visible:text-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
