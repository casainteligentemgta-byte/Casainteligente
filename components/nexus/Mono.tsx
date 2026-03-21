import { cn } from '@/lib/utils';

/** Datos numéricos: precios, SKU, coordenadas — JetBrains Mono */
export function Mono({
  children,
  className,
  as: Tag = 'span',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'span' | 'p' | 'div';
}) {
  return (
    <Tag className={cn('font-[family-name:var(--font-nexus-mono)] text-[0.95em] tracking-tight', className)}>
      {children}
    </Tag>
  );
}
