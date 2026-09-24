'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const current = value?.[0] ?? defaultValue?.[0] ?? min;
    const span = max - min || 1;
    const percent = Math.min(100, Math.max(0, ((current - min) / span) * 100));

    return (
      <div className={cn('relative flex h-5 w-full items-center', className)}>
        <div className="absolute h-1.5 w-full rounded-full bg-zinc-800" />
        <div className="absolute h-1.5 rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          onChange={(event) => onValueChange?.([Number(event.target.value)])}
          className="absolute inset-0 h-5 w-full cursor-pointer appearance-none bg-transparent accent-amber-500"
          {...props}
        />
      </div>
    );
  },
);
Slider.displayName = 'Slider';

export { Slider };
