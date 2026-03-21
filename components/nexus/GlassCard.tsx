'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  /** Resplandor neón en borde (CTA / activo) */
  glow?: boolean;
  as?: 'div' | 'article' | 'section';
};

export function GlassCard({ children, className, glow = false, as: Tag = 'div' }: GlassCardProps) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] p-5 backdrop-blur-[20px]',
        glow &&
          'shadow-[0_0_0_1px_rgba(0,242,254,0.2),0_0_40px_-10px_var(--color-primary-glow)] border-[rgba(0,242,254,0.25)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function GlassCardMotion(props: GlassCardProps & { delay?: number }) {
  const { delay = 0, ...rest } = props;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard {...rest} />
    </motion.div>
  );
}
