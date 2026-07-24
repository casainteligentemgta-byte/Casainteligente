'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type RadioGroupContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  name: string;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

function useRadioGroup() {
  const ctx = React.useContext(RadioGroupContext);
  if (!ctx) throw new Error('RadioGroupItem must be used within RadioGroup');
  return ctx;
}

type RadioGroupProps = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

function RadioGroup({ value, onValueChange, disabled, className, children }: RadioGroupProps) {
  const name = React.useId();
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, disabled, name }}>
      <div role="radiogroup" className={cn('grid gap-2', className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

type RadioGroupItemProps = {
  value: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

function RadioGroupItem({ value, id, disabled, className, children }: RadioGroupItemProps) {
  const ctx = useRadioGroup();
  const itemId = id ?? `${ctx.name}-${value}`;
  const checked = ctx.value === value;
  const isDisabled = disabled || ctx.disabled;

  return (
    <label
      htmlFor={itemId}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        checked
          ? 'border-[#FF9500]/40 bg-[#FF9500]/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
        isDisabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="radio"
        id={itemId}
        name={ctx.name}
        value={value}
        checked={checked}
        disabled={isDisabled}
        onChange={() => ctx.onValueChange(value)}
        className="h-4 w-4 shrink-0 accent-[#34C759] border-white/20 bg-[#0A0A0F]"
      />
      <span className="text-sm text-zinc-200 leading-snug">{children}</span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
