'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Bloqueo síncrono anti double-tap (iPad / 3G): el ref corta en el mismo tick del primer toque.
 */
export function useSyncSubmitLock() {
  const lockRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runLocked = useCallback(async (fn: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setIsSubmitting(true);
    try {
      await fn();
    } finally {
      lockRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, runLocked };
}
