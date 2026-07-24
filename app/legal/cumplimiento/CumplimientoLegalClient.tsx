'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Car,
  CheckCircle2,
  Loader2,
  Scale,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import type { LocaptemValidacion } from '@/lib/legal/locaptemValidator';
import type { VerificacionBanavih, VerificacionVehiculo } from '@/lib/legal/complianceRules';
import type { TsjSearchHit } from '@/lib/legal/tsjSearch';

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

function money(n: number) {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CumplimientoLegalClient() {
  // LOCAPTEM
  const [juridica, setJuridica] = useState(true);
  const [monto, setMonto] = useState('');
  const [tcmmv, setTcmmv] = useState('40.50');
  const [locLoading, setLocLoading] = useState(false);
  const [locRes, setLocRes] = useState<LocaptemValidacion | null>(null);

  // Vehículo
  const [fechaNotaria, setFechaNotaria] = useState('');
  const [titularCoincide, setTitularCoincide] = useState(true);
  const [vehLoading, setVehLoading] = useState(false);
  const [vehRes, setVehRes] = useState<VerificacionVehiculo | null>(null);

  // BANAVIH
  const [fechaConst, setFechaConst] = useState('');
  const [banLoading, setBanLoading] = useState(false);
  const [banRes, setBanRes] = useState<VerificacionBanavih | null>(null);

  // TSJ
  const [criterio, setCriterio] = useState('');
  const [tsjLoading, setTsjLoading] = useState(false);
  const [tsjItems, setTsjItems] = useState<TsjSearchHit[]>([]);
  const [tsjSimulated, setTsjSimulated] = useState(false);

  async function validarLocaptem(e: React.FormEvent) {
    e.preventDefault();
    setLocLoading(true);
    setLocRes(null);
    try {
      const res = await fetch(apiUrl('/api/legal/cumplimiento/locaptem'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          es_persona_juridica: juridica,
          monto_cobrado_bs: Number(monto),
          tcmmv_bcv: Number(tcmmv),
        }),
      });
      const data = (await res.json()) as { error?: string; resultado?: LocaptemValidacion };
      if (!res.ok) {
        toast.error(data.error || 'No se pudo validar');
        return;
      }
      setLocRes(data.resultado ?? null);
    } catch {
      toast.error('Error de red');
    } finally {
      setLocLoading(false);
    }
  }

  async function validarVehiculo(e: React.FormEvent) {
    e.preventDefault();
    setVehLoading(true);
    setVehRes(null);
    try {
      const res = await fetch(apiUrl('/api/legal/cumplimiento/vehiculo'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_notaria: fechaNotaria,
          titular_coincide_intt: titularCoincide,
        }),
      });
      const data = (await res.json()) as { error?: string; resultado?: VerificacionVehiculo };
      if (!res.ok) {
        toast.error(data.error || 'No se pudo evaluar');
        return;
      }
      setVehRes(data.resultado ?? null);
    } catch {
      toast.error('Error de red');
    } finally {
      setVehLoading(false);
    }
  }

  async function validarBanavih(e: React.FormEvent) {
    e.preventDefault();
    setBanLoading(true);
    setBanRes(null);
    try {
      const res = await fetch(apiUrl('/api/legal/cumplimiento/banavih'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_constitucion: fechaConst }),
      });
      const data = (await res.json()) as { error?: string; resultado?: VerificacionBanavih };
      if (!res.ok) {
        toast.error(data.error || 'No se pudo evaluar');
        return;
      }
      setBanRes(data.resultado ?? null);
    } catch {
      toast.error('Error de red');
    } finally {
      setBanLoading(false);
    }
  }

  async function buscarTsj(e: React.FormEvent) {
    e.preventDefault();
    if (!criterio.trim()) {
      toast.error('Indique nombre o cédula');
      return;
    }
    setTsjLoading(true);
    setTsjItems([]);
    try {
      const res = await fetch(
        apiUrl(`/api/legal/tsj/buscar?q=${encodeURIComponent(criterio.trim())}`),
        { credentials: 'include', cache: 'no-store' },
      );
      const data = (await res.json()) as {
        error?: string;
        items?: TsjSearchHit[];
        simulated?: boolean;
      };
      if (!res.ok) {
        toast.error(data.error || 'Búsqueda falló');
        return;
      }
      setTsjItems(data.items ?? []);
      setTsjSimulated(Boolean(data.simulated));
      if (data.simulated) {
        toast.message('Sin GOOGLE_API_KEY / GOOGLE_CSE_ID: resultado vacío (modo demo).');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setTsjLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">Cumplimiento regulatorio</h2>
        <p className="mt-1 text-sm text-zinc-500">
          LOCAPTEM, SAREN/INTT, BANAVIH y búsqueda de causas TSJ. No altera plantillas ni cálculos
          LOTTT.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Scale className="h-4 w-4 text-amber-300" />
          Validación de tasas (LOCAPTEM)
        </h3>
        <form onSubmit={(ev) => void validarLocaptem(ev)} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">Sujeto</label>
            <select
              className={campo}
              value={juridica ? 'j' : 'n'}
              onChange={(e) => setJuridica(e.target.value === 'j')}
            >
              <option value="j">Persona jurídica (≤ 500 × TCMMV)</option>
              <option value="n">Persona natural (≤ 10 × TCMMV)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              TCMMV BCV (Bs.)
            </label>
            <input
              className={campo}
              type="number"
              step="0.01"
              min="0"
              value={tcmmv}
              onChange={(e) => setTcmmv(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Monto cobrado (Bs.)
            </label>
            <input
              className={campo}
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={locLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50 sm:col-span-2 sm:w-fit"
          >
            {locLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Validar tasa
          </button>
        </form>
        {locRes ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              locRes.es_valido
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-red-500/30 bg-red-500/10 text-red-100'
            }`}
          >
            <p className="flex items-center gap-2 font-semibold">
              {locRes.es_valido ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {locRes.status}
            </p>
            <p className="mt-2 text-xs opacity-90">
              Límite legal: {money(locRes.limite_legal_bs)} Bs. ({locRes.limite_tcmmv} × TCMMV) ·
              Sobreprecio: {money(locRes.sobreprecio_bs)} Bs.
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Car className="h-4 w-4 text-amber-300" />
          Traspaso de vehículo (Notaría / INTT / SAREN)
        </h3>
        <form onSubmit={(ev) => void validarVehiculo(ev)} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Fecha firma notaría
            </label>
            <input
              type="date"
              className={campo}
              value={fechaNotaria}
              onChange={(e) => setFechaNotaria(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              ¿Vendedor = titular INTT?
            </label>
            <select
              className={campo}
              value={titularCoincide ? 's' : 'n'}
              onChange={(e) => setTitularCoincide(e.target.value === 's')}
            >
              <option value="s">Sí</option>
              <option value="n">No</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={vehLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50 sm:col-span-2 sm:w-fit"
          >
            {vehLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Evaluar trámite
          </button>
        </form>
        {vehRes ? (
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <p>
              ¿Trámite viable?:{' '}
              <span className={vehRes.viable ? 'text-emerald-300' : 'text-red-300'}>
                {vehRes.viable ? 'Sí' : 'No'}
              </span>
            </p>
            <p className="text-zinc-400">
              Días restantes sin multa INTT: {vehRes.dias_restantes} (transcurridos:{' '}
              {vehRes.dias_transcurridos})
            </p>
            {vehRes.alertas.map((a) => (
              <p key={a} className="flex gap-2 text-amber-100">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {a}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Building2 className="h-4 w-4 text-amber-300" />
          Registro patronal (BANAVIH)
        </h3>
        <form onSubmit={(ev) => void validarBanavih(ev)} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Fecha inscripción Registro Mercantil
            </label>
            <input
              type="date"
              className={campo}
              value={fechaConst}
              onChange={(e) => setFechaConst(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={banLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              {banLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Evaluar lapso
            </button>
          </div>
        </form>
        {banRes ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              banRes.vencido
                ? 'border-red-500/30 bg-red-500/10 text-red-100'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
            }`}
          >
            <p className="font-semibold">{banRes.alerta}</p>
            <p className="mt-1 text-xs opacity-90">
              Días transcurridos: {banRes.dias_transcurridos} / plazo aprox.{' '}
              {banRes.plazo_limite_dias} corridos
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Search className="h-4 w-4 text-amber-300" />
          Búsqueda de causas (TSJ)
        </h3>
        <form onSubmit={(ev) => void buscarTsj(ev)} className="flex flex-col gap-3 sm:flex-row">
          <input
            className={campo + ' mt-0 sm:flex-1'}
            value={criterio}
            onChange={(e) => setCriterio(e.target.value)}
            placeholder="Nombre completo o cédula"
          />
          <button
            type="submit"
            disabled={tsjLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {tsjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </form>
        {tsjSimulated && tsjItems.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Configure GOOGLE_API_KEY y GOOGLE_CSE_ID para consultas reales a site:tsj.gob.ve.
          </p>
        ) : null}
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {tsjItems.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">Sin coincidencias.</li>
          ) : (
            tsjItems.map((r, idx) => (
              <li key={`${r.enlace ?? idx}-${idx}`} className="px-4 py-3">
                <p className="font-medium text-zinc-100">{r.titulo}</p>
                {r.enlace ? (
                  <a
                    href={r.enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-xs text-amber-300/90 hover:underline"
                  >
                    {r.enlace}
                  </a>
                ) : null}
                {r.resumen ? <p className="mt-1 text-sm text-zinc-400">{r.resumen}</p> : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
