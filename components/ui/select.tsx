'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectItemData = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type SelectContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  items: SelectItemData[];
  registerItem: (item: SelectItemData) => void;
  unregisterItem: (value: string) => void;
  placeholder: string;
  setPlaceholder: (p: string) => void;
  disabled?: boolean;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('Select components must be used within <Select>');
  return ctx;
}

type SelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
};

function Select({ value, onValueChange, disabled, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<SelectItemData[]>([]);
  const [placeholder, setPlaceholder] = React.useState('Seleccionar…');

  const registerItem = React.useCallback((item: SelectItemData) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.value === item.value);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const unregisterItem = React.useCallback((itemValue: string) => {
    setItems((prev) => prev.filter((p) => p.value !== itemValue));
  }, []);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        open,
        setOpen,
        items,
        registerItem,
        unregisterItem,
        placeholder,
        setPlaceholder,
        disabled,
      }}
    >
      <div className="relative w-full">{children}</div>
    </SelectContext.Provider>
  );
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, value, items, placeholder, disabled } = useSelectContext();
  const selected = items.find((i) => i.value === value);

  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100',
        'ring-offset-[#0A0A0F] focus:outline-none focus:ring-2 focus:ring-[#FF9500]/40 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-xl',
        className,
      )}
      onClick={() => !disabled && setOpen(!open)}
      {...props}
    >
      <span className={cn('truncate text-left', !selected && 'text-zinc-500')}>
        {selected ? selected.label : children ?? placeholder}
      </span>
      <ChevronDown
        className={cn('ml-2 h-4 w-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')}
      />
    </button>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { setPlaceholder } = useSelectContext();
  React.useEffect(() => {
    if (placeholder) setPlaceholder(placeholder);
  }, [placeholder, setPlaceholder]);
  return null;
}

function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
  position?: 'popper' | 'item-aligned';
}) {
  const { open, setOpen, items, value, onValueChange } = useSelectContext();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpen]);

  return (
    <>
      {children}
      {open ? (
        <div
          ref={ref}
          role="listbox"
          className={cn(
            'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-white/10 bg-[#0A0A0F] p-1 shadow-2xl backdrop-blur-xl',
            className,
          )}
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-500">Sin opciones</p>
          ) : (
            items.map((item) => {
              const isSelected = value === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={item.disabled}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none',
                    'text-zinc-200 hover:bg-white/[0.08] focus:bg-white/[0.08]',
                    'disabled:pointer-events-none disabled:opacity-50',
                    isSelected && 'bg-[#FF9500]/15 text-[#FFD60A]',
                  )}
                  onClick={() => {
                    if (item.disabled) return;
                    onValueChange?.(item.value);
                    setOpen(false);
                  }}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {isSelected ? <Check className="h-4 w-4 text-[#34C759]" /> : null}
                  </span>
                  {item.label}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}

function SelectItem({
  value,
  children,
  disabled,
}: {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { registerItem, unregisterItem } = useSelectContext();

  React.useEffect(() => {
    registerItem({ value, label: children, disabled });
    return () => unregisterItem(value);
  }, [value, children, disabled, registerItem, unregisterItem]);

  return null;
}

function SelectGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500',
        className,
      )}
      {...props}
    />
  );
}

function SelectSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 my-1 h-px bg-white/10', className)} {...props} />;
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
