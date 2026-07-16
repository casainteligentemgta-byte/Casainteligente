'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type GlassModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function GlassModal({ open, onOpenChange, title, description, children, className }: GlassModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[100] bg-[#0A0B10]/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={cn(
                  'fixed left-1/2 top-1/2 z-[101] w-[min(100vw-2rem,520px)] -translate-x-1/2 -translate-y-1/2',
                  'rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(18,20,28,0.85)] p-6 backdrop-blur-[20px]',
                  'shadow-[0_0_0_1px_rgba(0,242,254,0.15),0_24px_80px_rgba(0,0,0,0.65)]',
                  'focus:outline-none',
                  className,
                )}
                initial={{ opacity: 0, scale: 0.96, y: '-48%' }}
                animate={{ opacity: 1, scale: 1, y: '-50%' }}
                exit={{ opacity: 0, scale: 0.96, y: '-48%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-lg font-semibold tracking-tight text-white">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-sm text-[var(--nexus-text-muted)]">
                        {description}
                      </Dialog.Description>
                    ) : null}
                  </div>
                  <Dialog.Close
                    className="rounded-lg p-2 text-[var(--nexus-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--nexus-cyan)]"
                    aria-label="Cerrar"
                  >
                    <X className="h-5 w-5 stroke-[2]" />
                  </Dialog.Close>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
