'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  formatBonoUsd,
  isBonoColumnMissingError,
  parseBonoUsd,
} from '@/lib/rrhh/projectAssignmentBono';

type Props = {
  assignmentId: string;
  value: number;
  onSaved?: (bono: number) => void;
  className?: string;
  compact?: boolean;
  /** Si el obrero ya suscribió contrato, el bono queda fijo (solo lectura). */
  readOnly?: boolean;
  readOnlyHint?: string;
};

export default function BonoUsdEditor({
  assignmentId,
  value,
  onSaved,
  className = '',
  compact = false,
  readOnly = false,
  readOnlyHint = 'Contrato ya suscrito: el bono no se puede modificar.',
}: Props) {
  const [text, setText] = useState(formatBonoUsd(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(formatBonoUsd(value));
  }, [value]);

  const guardar = async () => {
    if (readOnly) return;
    const bono = parseBonoUsd(text);
    if (bono === value) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('project_assignments')
      .update({ bono_usd: bono })
      .eq('id', assignmentId);
    setSaving(false);
    if (error) {
      if (isBonoColumnMissingError(error.message)) {
        toast.error('Falta la migración 154 (bono_usd en project_assignments). Ejecútala en Supabase.');
      } else {
        toast.error(error.message);
      }
      setText(formatBonoUsd(value));
      return;
    }
    setText(formatBonoUsd(bono));
    onSaved?.(bono);
    toast.success('Bono actualizado.');
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`.trim()}>
      <span className={`text-zinc-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>$</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={saving || readOnly}
        readOnly={readOnly}
        title={readOnly ? readOnlyHint : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void guardar()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void guardar();
          }
        }}
        className={
          compact
            ? `w-20 rounded border px-2 py-1 text-right text-xs font-semibold tabular-nums focus:outline-none ${
                readOnly
                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/80 text-zinc-500'
                  : 'border-zinc-700 bg-zinc-950 text-amber-200 focus:border-amber-500/50'
              }`
            : `w-24 rounded-lg border px-2 py-1.5 text-right text-sm font-semibold tabular-nums focus:outline-none ${
                readOnly
                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/80 text-zinc-500'
                  : 'border-zinc-700 bg-zinc-950 text-amber-200 focus:border-amber-500/50'
              }`
        }
        aria-label="Bono en USD"
      />
      {readOnly ? (
        <span className="max-w-[140px] text-[9px] leading-tight text-zinc-600" title={readOnlyHint}>
          Fijo
        </span>
      ) : saving ? (
        <span className="text-[10px] text-zinc-600">…</span>
      ) : null}
    </div>
  );
}
