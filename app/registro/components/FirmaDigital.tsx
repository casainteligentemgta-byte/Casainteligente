'use client';

import { useCallback, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';

export type FirmaDigitalGuardado = {
  dataUrl: string;
  eventId: string;
  capturedAtIso: string;
};

type Props = {
  value: FirmaDigitalGuardado | null;
  onChange: (v: FirmaDigitalGuardado | null) => void;
  disabled?: boolean;
};

export default function FirmaDigital({ value, onChange, disabled }: Props) {
  const ref = useRef<SignatureCanvas>(null);

  const limpiar = useCallback(() => {
    ref.current?.clear();
    onChange(null);
  }, [onChange]);

  const guardar = useCallback(() => {
    const sig = ref.current;
    if (!sig || sig.isEmpty()) {
      toast.error('Dibuja tu firma en el recuadro antes de guardar.');
      return;
    }
    const dataUrl = sig.toDataURL('image/png');
    const eventId = crypto.randomUUID();
    const capturedAtIso = new Date().toISOString();
    onChange({ dataUrl, eventId, capturedAtIso });
    toast.success('Firma lista. Puedes enviar la postulación.');
  }, [onChange]);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-400">
        Firma con el dedo o el lápiz en pantalla. El trazo se guarda como imagen y quedará en tu planilla legal impresa junto
        con espacio para firma autógrafa y huella en papel.
      </p>
      <div className="overflow-hidden rounded-xl border border-white/15 bg-white shadow-inner shadow-black/20">
        <SignatureCanvas
          ref={ref}
          penColor="#000000"
          backgroundColor="#ffffff"
          clearOnResize={false}
          canvasProps={{
            className: 'block w-full touch-none',
            style: { height: 168, touchAction: 'none' },
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={limpiar}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 disabled:opacity-50 min-[360px]:flex-none"
        >
          Limpiar
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={guardar}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50 min-[360px]:flex-[2]"
        >
          Guardar firma
        </button>
      </div>
      {value ? (
        <p className="text-[11px] text-emerald-400/90">
          Firma capturada (ID {value.eventId.slice(0, 8)}…). Usa «Limpiar» si quieres volver a firmar.
        </p>
      ) : null}
    </div>
  );
}
