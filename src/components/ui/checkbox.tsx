'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'h-4 w-4 shrink-0 rounded border border-zinc-600 bg-transparent',
        checked && 'border-amber-500 bg-amber-500 text-black',
        className,
      )}
      {...props}
    >
      {checked ? (
        <svg viewBox="0 0 16 16" className="h-full w-full" aria-hidden="true">
          <path
            d="M3.5 8.2 6.4 11l6.1-6.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  ),
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
