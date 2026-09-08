'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import type { FlotaManual } from '@/lib/flota/chatbot';
import { formatoFechaVe } from '@/lib/flota/utils';

export default function CargaManual({
  manuales,
  saving,
  onUpload,
  onDelete,
}: {
  manuales: FlotaManual[];
  saving?: boolean;
  onUpload: (fd: FormData) => Promise<void> | void;
  onDelete: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [texto, setTexto] = useState('');

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          if (titulo) fd.set('titulo', titulo);
          fd.set('vehiculo_marca', marca);
          fd.set('vehiculo_modelo', modelo);
          if (texto.trim()) fd.set('texto', texto.trim());
          void onUpload(fd);
        }}
      >
        <div className="sm:col-span-2">
          <label className={FLOTA_LABEL}>Título</label>
          <input className={FLOTA_INPUT} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Manual Hilux 2018" />
        </div>
        <div>
          <label className={FLOTA_LABEL}>Marca</label>
          <input className={FLOTA_INPUT} value={marca} onChange={(e) => setMarca(e.target.value)} />
        </div>
        <div>
          <label className={FLOTA_LABEL}>Modelo</label>
          <input className={FLOTA_INPUT} value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={FLOTA_LABEL}>Archivo (.txt, .md, .pdf)</label>
          <input className={FLOTA_INPUT} type="file" name="archivo" accept=".txt,.md,.pdf,.html" />
        </div>
        <div className="sm:col-span-2">
          <label className={FLOTA_LABEL}>O pegue el texto</label>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-zinc-500"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pegue procedimientos de taller…"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" variant="elite" disabled={saving}>
            {saving ? 'Procesando…' : 'Cargar manual'}
          </Button>
        </div>
      </form>

      {manuales.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay manuales. El mecánico responderá con guía general.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {manuales.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="text-white">{m.titulo}</p>
                <p className="text-xs text-zinc-500">
                  {[m.vehiculo_marca, m.vehiculo_modelo].filter(Boolean).join(' ') || 'General'} ·{' '}
                  {formatoFechaVe(m.created_at.slice(0, 10))}
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(m.id)}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
