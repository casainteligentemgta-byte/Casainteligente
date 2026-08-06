'use client';

import { useMemo, useState } from 'react';
import {
  CATALOGO_FASES_TECNICAS_OBRA,
  faseEstaSeleccionada,
  toggleFaseEnTexto,
} from '@/lib/talento/catalogoFasesTecnicasObra';

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Clases del select / textarea (compatibles con pantallas Express / proyecto). */
  controlClassName: string;
  /** Fases ya usadas (API / BD), mostradas como acceso rápido. */
  recientes?: string[];
  helperText?: string;
  placeholder?: string;
};

/**
 * Selector de fases técnicas (cláusula PRIMERA): categoría → checklist → texto compuesto editable.
 * Varias fases se unen con "; " en el contrato.
 */
export function SelectorFaseTecnicaContrato({
  value,
  onChange,
  controlClassName,
  recientes = [],
  helperText = 'Seleccione una o varias fases del catálogo. El texto queda editable y se graba para próximas obras.',
  placeholder = 'Seleccione fases del catálogo o escriba aquí…',
}: Props) {
  const [categoriaId, setCategoriaId] = useState(CATALOGO_FASES_TECNICAS_OBRA[0]?.id ?? '');

  const categoria = useMemo(
    () => CATALOGO_FASES_TECNICAS_OBRA.find((c) => c.id === categoriaId) ?? CATALOGO_FASES_TECNICAS_OBRA[0],
    [categoriaId],
  );

  const recientesUnicas = useMemo(() => {
    const catalogKeys = new Set(
      CATALOGO_FASES_TECNICAS_OBRA.flatMap((c) => c.fases.map((f) => f.toLowerCase())),
    );
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of recientes) {
      const s = t.trim();
      if (s.length < 2) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      // Evitar duplicar ítems del catálogo en "recientes" (ya están en la lista).
      if (catalogKeys.has(k)) continue;
      // Textos compuestos del lote: mostrar solo si no son exactamente un ítem del catálogo.
      seen.add(k);
      out.push(s);
      if (out.length >= 8) break;
    }
    return out;
  }, [recientes]);

  return (
    <div className="space-y-2">
      {recientesUnicas.length > 0 ? (
        <select
          className={controlClassName}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) onChange(v);
          }}
        >
          <option value="">— Usar fase guardada / personalizada —</option>
          {recientesUnicas.map((t) => (
            <option key={t} value={t}>
              {t.length > 120 ? `${t.slice(0, 117)}…` : t}
            </option>
          ))}
        </select>
      ) : null}

      <select
        className={controlClassName}
        value={categoria?.id ?? ''}
        onChange={(e) => setCategoriaId(e.target.value)}
      >
        {CATALOGO_FASES_TECNICAS_OBRA.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      {categoria ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
          {categoria.fases.map((fase, i) => {
            const checked = faseEstaSeleccionada(value, fase);
            return (
              <li key={fase}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-left text-[12px] font-normal normal-case tracking-normal text-zinc-200 hover:bg-white/5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/40"
                    checked={checked}
                    onChange={() => onChange(toggleFaseEnTexto(value, fase))}
                  />
                  <span>
                    <span className="mr-1 tabular-nums text-zinc-500">{i + 1}.</span>
                    {fase}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      <textarea
        className={`${controlClassName} min-h-[4rem]`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="block text-[11px] font-normal normal-case tracking-normal text-zinc-600">
        {helperText}
      </span>
    </div>
  );
}
