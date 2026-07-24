'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
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
  triggerEl: HTMLButtonElement | null;
  setTriggerEl: (el: HTMLButtonElement | null) => void;
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
  const [triggerEl, setTriggerEl] = React.useState<HTMLButtonElement | null>(null);

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
        triggerEl,
        setTriggerEl,
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
  const { open, setOpen, value, items, placeholder, disabled, setTriggerEl } = useSelectContext();
  const selected = items.find((i) => i.value === value);

  const mergedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      setTriggerEl(node);
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref, setTriggerEl],
  );

  return (
    <button
      ref={mergedRef}
      type="button"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        'flex min-h-10 w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100',
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
  const { open, setOpen, items, value, onValueChange, triggerEl } = useSelectContext();
  const ref = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0, maxHeight: 320 });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const actualizarPosicion = React.useCallback(() => {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const gap = 4;
    const espacioAbajo = window.innerHeight - rect.bottom - gap - 8;
    const espacioArriba = rect.top - gap - 8;
    const abrirArriba = espacioAbajo < 180 && espacioArriba > espacioAbajo;
    const maxHeight = Math.max(160, Math.min(420, abrirArriba ? espacioArriba : espacioAbajo));
    const top = abrirArriba ? rect.top - gap - maxHeight : rect.bottom + gap;
    setCoords({
      top: Math.max(8, top),
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [triggerEl]);

  React.useEffect(() => {
    if (!open) return;
    actualizarPosicion();
    const onScroll = () => actualizarPosicion();
    const onResize = () => actualizarPosicion();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, actualizarPosicion]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (triggerEl?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpen, triggerEl]);

  const lista = (
    <div
      ref={ref}
      role="listbox"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
        zIndex: 9999,
      }}
      className={cn(
        'overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-[#0A0A0F] p-1 shadow-2xl backdrop-blur-xl',
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
                'relative flex w-full cursor-pointer select-none items-start rounded-md py-2 pl-8 pr-2 text-left text-sm outline-none',
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
              <span className="absolute left-2 top-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected ? <Check className="h-4 w-4 text-[#34C759]" /> : null}
              </span>
              <span className="min-w-0 break-words">{item.label}</span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <>
      {children}
      {open && mounted ? createPortal(lista, document.body) : null}
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
  const label = React.useMemo(() => children, [children]);

  React.useEffect(() => {
    registerItem({ value, label, disabled });
    return () => unregisterItem(value);
  }, [value, label, disabled, registerItem, unregisterItem]);

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
