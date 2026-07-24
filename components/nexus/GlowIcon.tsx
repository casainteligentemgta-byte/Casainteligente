'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type GlowIconProps = {
  icon: LucideIcon;
  className?: string;
  size?: number;
};

/** Icono línea fina (2pt) con glow cian al hover */
export function GlowIcon({ icon: Icon, className, size = 20 }: GlowIconProps) {
  return (
    <span
      className={cn(
        'inline-flex text-[var(--nexus-text-muted)] transition-all duration-300',
        'hover:text-[var(--nexus-cyan)] hover:drop-shadow-[0_0_10px_var(--color-primary-glow)]',
        className,
      )}
    >
      <Icon className="stroke-[2]" size={size} strokeWidth={2} />
    </span>
  );
}
