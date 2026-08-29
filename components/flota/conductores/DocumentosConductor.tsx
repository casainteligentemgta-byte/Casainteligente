'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import type { FlotaConductorDocumento } from '@/lib/flota/conductores';
import { TIPOS_DOCUMENTO_CONDUCTOR, formatoFechaVe } from '@/lib/flota/utils';

export default function DocumentosConductor({
  documentos,
  saving,
  onAdd,
  onDelete,
}: {
  documentos: FlotaConductorDocumento[];
  saving?: boolean;
  onAdd: (payload: {
    tipo: string;
    nombre: string;
    vence_el: string;
    archivo_base64?: string;
    archivo_nombre?: string;
    archivo_mime?: string;
  }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [tipo, setTipo] = useState('licencia');
  const [nombre, setNombre] = useState('');
  const [vence, setVence] = useState('');
  const [archivo, setArchivo] = useState<{ b64: string; name: string; mime: string } | null>(null);

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">Documentos</h3>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onAdd({
            tipo,
            nombre: nombre || tipo,
            vence_el: vence,
            archivo_base64: archivo?.b64,
            archivo_nombre: archivo?.name,
            archivo_mime: archivo?.mime,
          });
          setNombre('');
          setVence('');
          setArchivo(null);
        }}
      >
        <div>
          <label className={FLOTA_LABEL}>Tipo</label>
          <select className={FLOTA_INPUT} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_DOCUMENTO_CONDUCTOR.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={FLOTA_LABEL}>Nombre</label>
          <input className={FLOTA_INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Licencia 4ta" />
        </div>
        <div>
          <label className={FLOTA_LABEL}>Vence</label>
          <input className={FLOTA_INPUT} type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
        </div>
        <div>
          <label className={FLOTA_LABEL}>Archivo</label>
          <input
            className={FLOTA_INPUT}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) {
                setArchivo(null);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                setArchivo({ b64: String(reader.result ?? ''), name: f.name, mime: f.type });
              };
              reader.readAsDataURL(f);
            }}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" variant="elite" disabled={saving}>
            {saving ? 'Guardando…' : 'Agregar documento'}
          </Button>
        </div>
      </form>

      {documentos.length === 0 ? (
        <p className="text-sm text-zinc-500">Sin documentos cargados.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p className="text-white">{d.nombre}</p>
                <p className="text-xs text-zinc-500">
                  {d.tipo} · vence {formatoFechaVe(d.vence_el)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-amber-300 hover:underline">
                    Ver
                  </a>
                ) : null}
                <Button type="button" size="sm" variant="ghost" onClick={() => void onDelete(d.id)}>
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
