'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Skeleton con pulso neón acorde a la marca Nexus */
export function NexusSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn(
        'rounded-xl bg-gradient-to-r from-[rgba(0,242,254,0.08)] via-[rgba(255,255,255,0.06)] to-[rgba(0,242,254,0.08)]',
        'border border-[rgba(255,255,255,0.06)]',
        className,
      )}
      animate={{
        opacity: [0.5, 0.9, 0.5],
        boxShadow: [
          '0 0 0 0 rgba(0,242,254,0)',
          '0 0 20px -4px rgba(0,242,254,0.15)',
          '0 0 0 0 rgba(0,242,254,0)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export function NexusSkeletonCard() {
  return (
    <div className="space-y-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-[20px]">
      <NexusSkeleton className="h-4 w-1/3" />
      <NexusSkeleton className="h-3 w-full" />
      <NexusSkeleton className="h-3 w-5/6" />
      <NexusSkeleton className="mt-4 h-24 w-full" />
    </div>
  );
}
