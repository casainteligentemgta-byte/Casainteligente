'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import ClienteLegalSelect from '@/components/legal/ClienteLegalSelect';
import {
  esAmbitoCasoExterno,
  LEGAL_AMBITOS,
  LEGAL_AMBITOS_ENTIDAD,
  LEGAL_PRIORIDADES,
  LEGAL_TIPOS_CASO,
  normalizarAmbitoLegal,
} from '@/lib/legal/casosCatalogo';
import { useAccesoLegal } from '@/lib/legal/AccesoLegalContext';

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

export default function LegalCasoNuevoPage() {
  const router = useRouter();
  const acceso = useAccesoLegal();
  const ambitos = useMemo(
    () =>
      acceso.standalone
        ? LEGAL_AMBITOS.filter((a) => !LEGAL_AMBITOS_ENTIDAD.has(a.value))
        : LEGAL_AMBITOS,
    [acceso.standalone],
  );
  const tipos = useMemo(
    () =>
      acceso.standalone
        ? LEGAL_TIPOS_CASO.filter((t) => !t.value.startsWith('obra_'))
        : LEGAL_TIPOS_CASO,
    [acceso.standalone],
  );

  const [enviando, setEnviando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('laboral');
  const [ambito, setAmbito] = useState(
    acceso.standalone ? 'despacho' : 'casa_inteligente',
  );
  const [prioridad, setPrioridad] = useState('media');
  const [contraparte, setContraparte] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [despachoAbogado, setDespachoAbogado] = useState('');
  const [resumen, setResumen] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [numeroExpediente, setNumeroExpediente] = useState('');
  const [organoTribunal, setOrganoTribunal] = useState('');
  const [faseActual, setFaseActual] = useState('');

  const casoExterno = esAmbitoCasoExterno(ambito);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error('Indica el título del expediente');
      return;
    }
    if (casoExterno && !despachoAbogado.trim()) {
      toast.error('Indica el despacho o el abogado del caso externo');
      return;
    }
    setEnviando(true);
    try {
      let ambitoFinal = normalizarAmbitoLegal(ambito);
      if (acceso.standalone && LEGAL_AMBITOS_ENTIDAD.has(ambitoFinal)) {
        ambitoFinal = 'despacho';
      }
      const res = await fetch(apiUrl('/api/legal/casos'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          tipo,
          ambito: ambitoFinal,
          prioridad,
          contraparte: contraparte.trim() || null,
          cliente_id: clienteId || null,
          cliente_nombre: clienteNombre.trim() || null,
          despacho_abogado: casoExterno ? despachoAbogado.trim() || null : null,
          resumen: resumen.trim() || null,
          fecha_limite: fechaLimite || null,
          numero_expediente: numeroExpediente.trim() || null,
          organo_tribunal: organoTribunal.trim() || null,
          fase_actual: faseActual.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        caso?: { id: string; codigo?: string | null };
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'No se pudo crear');
        return;
      }
      toast.success(
        data.caso?.codigo
          ? `Expediente ${data.caso.codigo} creado`
          : 'Expediente creado',
      );
      router.push(`/legal/casos/${data.caso!.id}`);
    } catch {
      toast.error('Error de red');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Nuevo expediente</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Se asignará automáticamente un código único{' '}
          <span className="font-mono text-amber-200/90">EXP-YYYY-XXX</span>.
          {acceso.standalone
            ? ' Casos de despacho o asuntos externos.'
            : ' Entidad Casa Inteligente / Dimaquinas, despacho general o caso externo.'}
        </p>
      </div>
      <form
        onSubmit={(ev) => void onSubmit(ev)}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
      >
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">Título *</label>
          <input
            className={campo}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Reclamo laboral / fiscalización SENIAT"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500">Entidad</label>
            <select className={campo} value={ambito} onChange={(e) => setAmbito(e.target.value)}>
              {ambitos.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500">
              Rama / tipo
            </label>
            <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {tipos.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          {casoExterno ? (
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                Despacho o abogado *
              </label>
              <input
                className={campo}
                value={despachoAbogado}
                onChange={(e) => setDespachoAbogado(e.target.value)}
                placeholder="Nombre del despacho o del abogado externo"
              />
            </div>
          ) : null}
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500">Prioridad</label>
            <select
              className={campo}
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
            >
              {LEGAL_PRIORIDADES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500">Fecha límite</label>
            <input
              type="date"
              className={campo}
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500">
              N° expediente (opcional)
            </label>
            <input
              className={campo}
              value={numeroExpediente}
              onChange={(e) => setNumeroExpediente(e.target.value)}
              placeholder="Exp. N° …"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-zinc-500">
              Órgano / tribunal
            </label>
            <input
              className={campo}
              value={organoTribunal}
              onChange={(e) => setOrganoTribunal(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-zinc-500">Fase actual</label>
            <input
              className={campo}
              value={faseActual}
              onChange={(e) => setFaseActual(e.target.value)}
              placeholder="Preparatoria"
            />
          </div>
        </div>
        <ClienteLegalSelect
          valueId={clienteId}
          className={campo}
          onChange={({ id, label }) => {
            setClienteId(id);
            setClienteNombre(label);
          }}
        />
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">Contraparte</label>
          <input
            className={campo}
            value={contraparte}
            onChange={(e) => setContraparte(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">Resumen</label>
          <textarea
            className={`${campo} min-h-[100px]`}
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Crear expediente
        </button>
      </form>
    </div>
  );
}
