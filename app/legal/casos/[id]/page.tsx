'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FilePlus2, Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  etiquetaDe,
  LEGAL_ESTADOS,
  LEGAL_PRIORIDADES,
  LEGAL_TIPOS_ACTUACION,
  LEGAL_AMBITOS,
  LEGAL_TIPOS_CASO,
} from '@/lib/legal/casosCatalogo';
import {
  LEGAL_TIPOS_DOCUMENTO,
  LEGAL_ESTADOS_DOCUMENTO,
} from '@/lib/legal/documentosCatalogo';

type Caso = {
  id: string;
  codigo: string | null;
  titulo: string;
  tipo: string;
  ambito: string;
  estado: string;
  prioridad: string;
  resumen: string | null;
  contraparte: string | null;
  cliente_nombre: string | null;
  fecha_limite: string | null;
};

type Actuacion = {
  id: string;
  tipo: string;
  titulo: string | null;
  detalle: string | null;
  ocurrio_at: string;
};

type Documento = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  contraparte: string | null;
  caso_id: string | null;
  updated_at: string;
};

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

export default function LegalCasoDetallePage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [caso, setCaso] = useState<Caso | null>(null);
  const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [disponibles, setDisponibles] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [actTipo, setActTipo] = useState('nota');
  const [actTitulo, setActTitulo] = useState('');
  const [actDetalle, setActDetalle] = useState('');
  const [enviandoAct, setEnviandoAct] = useState(false);
  const [docSeleccionado, setDocSeleccionado] = useState('');
  const [asociando, setAsociando] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [resCaso, resDisp] = await Promise.all([
        fetch(apiUrl(`/api/legal/casos/${id}`), {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(apiUrl('/api/legal/documentos?sin_caso=1&plantillas=0'), {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      const data = (await resCaso.json()) as {
        caso?: Caso;
        actuaciones?: Actuacion[];
        documentos?: Documento[];
        error?: string;
      };
      if (!resCaso.ok) {
        setError(data.error || 'No se pudo cargar');
        return;
      }
      setCaso(data.caso ?? null);
      setEstado(data.caso?.estado ?? '');
      setActuaciones(data.actuaciones ?? []);
      setDocumentos(data.documentos ?? []);

      if (resDisp.ok) {
        const disp = (await resDisp.json()) as { documentos?: Documento[] };
        setDisponibles(disp.documentos ?? []);
      }
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardarEstado() {
    if (!caso) return;
    setGuardando(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const data = (await res.json()) as { error?: string; caso?: Caso };
      if (!res.ok) {
        toast.error(data.error || 'No se guardó');
        return;
      }
      setCaso(data.caso ?? caso);
      toast.success('Estado actualizado');
    } catch {
      toast.error('Error de red');
    } finally {
      setGuardando(false);
    }
  }

  async function agregarActuacion(e: React.FormEvent) {
    e.preventDefault();
    if (!caso) return;
    setEnviandoAct(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}/actuaciones`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: actTipo,
          titulo: actTitulo.trim() || null,
          detalle: actDetalle.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'No se registró');
        return;
      }
      toast.success('Actuación registrada');
      setActTitulo('');
      setActDetalle('');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setEnviandoAct(false);
    }
  }

  async function asociarDocumento() {
    if (!caso || !docSeleccionado) return;
    setAsociando(true);
    try {
      const docMeta = disponibles.find((d) => d.id === docSeleccionado);
      const res = await fetch(apiUrl(`/api/legal/documentos/${docSeleccionado}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso_id: caso.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'No se asoció');
        return;
      }
      await fetch(apiUrl(`/api/legal/casos/${caso.id}/actuaciones`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'documento',
          titulo: docMeta
            ? `Asociado: ${docMeta.titulo}`
            : 'Documento asociado al expediente',
          detalle: docMeta
            ? `Se vinculó ${etiquetaDe(LEGAL_TIPOS_DOCUMENTO, docMeta.tipo)} «${docMeta.titulo}» al expediente ${caso.codigo || caso.id}.`
            : 'Documento vinculado al expediente.',
        }),
      });
      toast.success('Documento asociado al expediente');
      setDocSeleccionado('');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setAsociando(false);
    }
  }

  async function desasociarDocumento(docId: string) {
    setAsociando(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/documentos/${docId}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso_id: null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'No se desasoció');
        return;
      }
      toast.success('Documento desasociado');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setAsociando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !caso) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error || 'Expediente no encontrado'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-wide text-amber-300/90">
          {caso.codigo || 'SIN-CÓDIGO'}
        </p>
        <p className="mt-1 text-xs uppercase tracking-wide text-amber-500/80">
          {etiquetaDe(LEGAL_AMBITOS, caso.ambito)} · {etiquetaDe(LEGAL_TIPOS_CASO, caso.tipo)}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">{caso.titulo}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {caso.cliente_nombre ? `Cliente: ${caso.cliente_nombre}` : null}
          {caso.contraparte ? ` · Contraparte: ${caso.contraparte}` : null}
          {caso.fecha_limite ? ` · Límite: ${caso.fecha_limite}` : null}
        </p>
        {caso.resumen ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{caso.resumen}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div>
          <label className="text-[10px] font-semibold uppercase text-zinc-500">Estado</label>
          <select className={campo} value={estado} onChange={(e) => setEstado(e.target.value)}>
            {LEGAL_ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="pb-1 text-xs text-zinc-500">
          Prioridad: {etiquetaDe(LEGAL_PRIORIDADES, caso.prioridad)}
        </div>
        <button
          type="button"
          onClick={() => void guardarEstado()}
          disabled={guardando}
          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar estado'}
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Contratos y cartas asociadas</h3>
          <Link
            href={`/legal/documentos/nuevo?caso=${caso.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Generar documento
          </Link>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="min-w-[220px] flex-1">
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Asociar documento existente
            </label>
            <select
              className={campo}
              value={docSeleccionado}
              onChange={(e) => setDocSeleccionado(e.target.value)}
            >
              <option value="">Seleccione contrato / carta…</option>
              {disponibles.map((d) => (
                <option key={d.id} value={d.id}>
                  {etiquetaDe(LEGAL_TIPOS_DOCUMENTO, d.tipo)} · {d.titulo}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!docSeleccionado || asociando}
            onClick={() => void asociarDocumento()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            {asociando ? 'Asociando…' : 'Asociar'}
          </button>
        </div>

        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {documentos.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">
              Sin contratos ni cartas vinculadas. Genere uno desde Formatos/Documentos o asocie
              uno existente.
            </li>
          ) : (
            documentos.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <Link
                  href={`/legal/documentos/${d.id}`}
                  className="min-w-0 flex-1 hover:text-amber-100"
                >
                  <p className="text-[10px] font-semibold uppercase text-amber-500/80">
                    {etiquetaDe(LEGAL_TIPOS_DOCUMENTO, d.tipo)} ·{' '}
                    {etiquetaDe(LEGAL_ESTADOS_DOCUMENTO, d.estado)}
                  </p>
                  <p className="font-medium text-zinc-100">{d.titulo}</p>
                </Link>
                <button
                  type="button"
                  disabled={asociando}
                  onClick={() => void desasociarDocumento(d.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:border-red-500/30 hover:text-red-200 disabled:opacity-50"
                  title="Desasociar del expediente"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Quitar
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">Bitácora de actuaciones</h3>
        <form
          onSubmit={(ev) => void agregarActuacion(ev)}
          className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase text-zinc-500">Tipo</label>
              <select className={campo} value={actTipo} onChange={(e) => setActTipo(e.target.value)}>
                {LEGAL_TIPOS_ACTUACION.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-zinc-500">Título</label>
              <input
                className={campo}
                value={actTitulo}
                onChange={(e) => setActTitulo(e.target.value)}
                placeholder="Ej. Audiencia preliminar / llamada a cliente"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">Detalle</label>
            <textarea
              className={campo + ' min-h-[80px]'}
              value={actDetalle}
              onChange={(e) => setActDetalle(e.target.value)}
              placeholder="Qué se hizo / qué falta / acuerdos…"
            />
          </div>
          <button
            type="submit"
            disabled={enviandoAct}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {enviandoAct ? 'Guardando…' : 'Registrar actuación'}
          </button>
        </form>

        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {actuaciones.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">Sin actuaciones aún.</li>
          ) : (
            actuaciones.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase text-amber-500/80">
                  {etiquetaDe(LEGAL_TIPOS_ACTUACION, a.tipo)} ·{' '}
                  {new Date(a.ocurrio_at).toLocaleString('es-VE')}
                </p>
                {a.titulo ? <p className="mt-0.5 font-medium text-zinc-100">{a.titulo}</p> : null}
                {a.detalle ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">{a.detalle}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
