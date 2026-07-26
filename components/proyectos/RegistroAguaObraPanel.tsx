'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Droplets, ExternalLink, Plus, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { RegistroAguaRow } from '@/app/api/proyectos/[proyectoId]/registro-agua/route';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

type Props = {
  proyectoId: string;
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtLitros(r: RegistroAguaRow): string {
  if (r.litros_entregados == null) return '—';
  return `${Number(r.litros_entregados).toLocaleString('es-VE')} L`;
}

function fmtPpm(r: RegistroAguaRow): string {
  const ppm =
    r.ppm_minerales ??
    (r.unidad_medicion?.toLowerCase().includes('ppm') ? r.medicion_agua : null);
  if (ppm == null) return '—';
  return `${ppm} ppm`;
}

/** Valor para `<input type="datetime-local">` en zona local del navegador. */
function toDatetimeLocalValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40';
const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-zinc-500';

export default function RegistroAguaObraPanel({ proyectoId }: Props) {
  const [registros, setRegistros] = useState<RegistroAguaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [fotoTanque, setFotoTanque] = useState<File | null>(null);
  const [fotoPrueba, setFotoPrueba] = useState<File | null>(null);
  const [registradoEn, setRegistradoEn] = useState(() => toDatetimeLocalValue());
  const [placa, setPlaca] = useState('');
  const [litros, setLitros] = useState('');
  const [ppm, setPpm] = useState('');

  const previewTanque = useMemo(
    () => (fotoTanque ? URL.createObjectURL(fotoTanque) : null),
    [fotoTanque],
  );
  const previewPrueba = useMemo(
    () => (fotoPrueba ? URL.createObjectURL(fotoPrueba) : null),
    [fotoPrueba],
  );

  useEffect(() => {
    return () => {
      if (previewTanque) URL.revokeObjectURL(previewTanque);
    };
  }, [previewTanque]);

  useEffect(() => {
    return () => {
      if (previewPrueba) URL.revokeObjectURL(previewPrueba);
    };
  }, [previewPrueba]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/registro-agua`,
      );
      const data = await parseFetchJson<{ error?: string; registros?: RegistroAguaRow[] }>(
        res,
      );
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'Error al cargar registros'));
      setRegistros(data.registros ?? []);
    } catch (e) {
      setError(formatErrorMessage(e));
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setFotoTanque(null);
    setFotoPrueba(null);
    setRegistradoEn(toDatetimeLocalValue());
    setPlaca('');
    setLitros('');
    setPpm('');
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!fotoTanque || !fotoPrueba) {
      toast.error('Suba la foto del camión/tanque y la de prueba PPM.');
      return;
    }
    if (!registradoEn.trim()) {
      toast.error('Indique la fecha del registro.');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set('foto_tanque', fotoTanque);
      fd.set('foto_prueba', fotoPrueba);
      fd.set('registrado_en', new Date(registradoEn).toISOString());
      if (placa.trim()) fd.set('placa_vehiculo', placa.trim());
      if (litros.trim()) fd.set('litros_entregados', litros.trim());
      if (ppm.trim()) fd.set('ppm_minerales', ppm.trim());

      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/registro-agua`,
        { method: 'POST', body: fd },
      );
      const data = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'No se pudo guardar'));
      toast.success('Registro de agua guardado.');
      resetForm();
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function guardarFecha(r: RegistroAguaRow, valueLocal: string) {
    if (!valueLocal.trim()) return;
    setEditandoId(r.id);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/registro-agua`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: r.id,
            registrado_en: new Date(valueLocal).toISOString(),
          }),
        },
      );
      const data = await parseFetchJson<{ error?: string; registro?: RegistroAguaRow }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'No se pudo actualizar la fecha'));
      if (data.registro) {
        setRegistros((prev) =>
          prev
            .map((x) => (x.id === r.id ? data.registro! : x))
            .sort(
              (a, b) =>
                new Date(b.registrado_en || b.created_at).getTime() -
                new Date(a.registrado_en || a.created_at).getTime(),
            ),
        );
      }
      toast.success('Fecha actualizada.');
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setEditandoId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Registro de agua</h2>
          <span className="text-xs text-zinc-500">({registros.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            {formOpen ? 'Cerrar' : 'Agregar registro'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <p className="text-sm text-zinc-500">
        Entradas desde Telegram (<code className="text-sky-300">/agua</code>) o carga manual aquí:
        suba fotos tomadas en días anteriores y ajuste la fecha del registro.
      </p>

      {formOpen ? (
        <form
          onSubmit={(e) => void guardar(e)}
          className="space-y-4 rounded-xl border border-sky-500/25 bg-sky-950/20 p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-100">
            <Upload className="h-4 w-4" />
            Nuevo registro (fotos + fecha)
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelCls}>Fecha del registro</span>
              <input
                type="datetime-local"
                value={registradoEn}
                onChange={(e) => setRegistradoEn(e.target.value)}
                required
                className={inputCls}
              />
              <span className="block text-[11px] text-zinc-500">
                Use la fecha real del día en que se tomaron las fotos.
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Placa (opcional)</span>
              <input
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                placeholder="ABC12D"
                className={`${inputCls} font-mono uppercase`}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Litros entregados (opcional)</span>
              <input
                type="number"
                min={0}
                step="1"
                value={litros}
                onChange={(e) => setLitros(e.target.value)}
                placeholder="1500"
                className={inputCls}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>PPM minerales (opcional)</span>
              <input
                type="number"
                min={0}
                step="1"
                value={ppm}
                onChange={(e) => setPpm(e.target.value)}
                placeholder="120"
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelCls}>Foto camión / tanque (placa)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFotoTanque(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                required
              />
              {previewTanque ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewTanque}
                  alt="Vista previa tanque"
                  className="mt-2 h-28 w-full rounded-lg border border-white/10 object-cover"
                />
              ) : null}
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Foto prueba PPM (medidor azul)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFotoPrueba(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                required
              />
              {previewPrueba ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewPrueba}
                  alt="Vista previa prueba"
                  className="mt-2 h-28 w-full rounded-lg border border-white/10 object-cover"
                />
              ) : null}
            </label>
          </div>

          <p className="text-[11px] text-zinc-500">
            Si deja placa o PPM vacíos y hay Gemini configurado, se intentará leerlos de las fotos.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar registro'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading && registros.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando registros…
        </p>
      ) : null}

      {!loading && !error && registros.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
          Aún no hay registros de agua para esta obra. Use «Agregar registro» o el comando{' '}
          <code className="text-sky-300">/agua</code> en Telegram.
        </p>
      ) : null}

      {registros.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-900/80 text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Placa</th>
                <th className="px-3 py-2 font-semibold">Litros</th>
                <th className="px-3 py-2 font-semibold">PPM</th>
                <th className="px-3 py-2 font-semibold">Registró</th>
                <th className="px-3 py-2 font-semibold">Fotos</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-zinc-300">
                    <div className="space-y-1">
                      <span className="whitespace-nowrap text-xs text-zinc-400">
                        {fmtFecha(r.registrado_en || r.created_at)}
                      </span>
                      <input
                        type="datetime-local"
                        defaultValue={toDatetimeLocalValue(r.registrado_en || r.created_at)}
                        disabled={editandoId === r.id}
                        onBlur={(e) => {
                          const next = e.target.value;
                          const prev = toDatetimeLocalValue(r.registrado_en || r.created_at);
                          if (next && next !== prev) void guardarFecha(r, next);
                        }}
                        className="block w-[11.5rem] rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-zinc-200 outline-none focus:border-sky-500/40 disabled:opacity-50"
                        title="Modificar fecha del registro"
                        aria-label={`Modificar fecha del registro ${r.id}`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-amber-200">
                    {r.placa_vehiculo?.trim() || '—'}
                  </td>
                  <td className="px-3 py-2 text-emerald-200 font-medium">{fmtLitros(r)}</td>
                  <td className="px-3 py-2 text-sky-200">{fmtPpm(r)}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.creado_por}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={r.foto_tanque_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        Tanque
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={r.foto_prueba_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        Prueba
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
