'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nexus-bg-base)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--nexus-cyan)] text-[#0A0B10] shadow-[0_0_24px_var(--color-primary-glow)] hover:shadow-[0_0_32px_var(--color-primary-glow)] hover:brightness-110',
        glass:
          'border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-white backdrop-blur-xl hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(0,242,254,0.35)]',
        ghost: 'text-[var(--nexus-text-muted)] hover:text-[var(--nexus-cyan)] hover:bg-[rgba(0,242,254,0.08)]',
        success:
          'bg-[var(--nexus-green)]/20 text-[var(--nexus-green)] border border-[var(--nexus-green)]/40 hover:bg-[var(--nexus-green)]/30',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
