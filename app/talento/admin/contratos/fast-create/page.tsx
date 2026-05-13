'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  CESTATICKET_MENSUAL_USD,
  CESTATICKET_SEMANAL_USD,
  cestaticketSemanalBolivaresAlTipoCambioBcV,
} from '@/lib/nomina/cestaticketLegalUsd';
import {
  ingresoSemanalConsolidadoUsdDesdeConfigNominaCestaticketUsd40,
  salarioBaseSemanalBolivares,
  type ConfigNominaTabuladorLike,
} from '@/lib/nomina/ingresoSemanalDesdeConfigNomina';
import { bonoUsdABs, tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';
import { HorarioSemanalExpressForm } from './HorarioSemanalExpressForm';

type ProyectoOpt = {
  id: string;
  nombre: string;
};

type NominaRow = {
  id: string;
  cargo_nombre: string;
  salario_base_mensual: number | string | null;
  cestaticket_mensual?: number | string | null;
  cargo_codigo?: string | null;
  nivel_salarial?: number | null;
};

type ProyectoDetalle = {
  id: string;
  nombre: string;
  entidad_id?: string | null;
  horario_semanal_obra_default?: string | null;
  ci_entidades?: { nombre: string; rif: string | null } | { nombre: string; rif: string | null }[] | null;
};

const fmtBs = (n: number) =>
  new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function entidadDesdeProyecto(p: ProyectoDetalle | null): { nombre: string; rif: string | null } | null {
  const raw = p?.ci_entidades;
  if (!raw) return null;
  const e = Array.isArray(raw) ? raw[0] : raw;
  if (!e || typeof e !== 'object') return null;
  return { nombre: (e.nombre ?? '').trim(), rif: (e.rif ?? '').trim() || null };
}

export default function ContratoExpressCreatePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [nominas, setNominas] = useState<NominaRow[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [proyectoId, setProyectoId] = useState('');
  const [proyectoDetalle, setProyectoDetalle] = useState<ProyectoDetalle | null>(null);
  const [entidadPatronoId, setEntidadPatronoId] = useState('');
  const [configNominaId, setConfigNominaId] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [cedula, setCedula] = useState('');
  const [esVenezolano, setEsVenezolano] = useState(true);
  const [nacionalidadOtro, setNacionalidadOtro] = useState('');
  const [bonoStr, setBonoStr] = useState('0');
  const [direccion, setDireccion] = useState('');
  const [obreroMunicipioResidencia, setObreroMunicipioResidencia] = useState('');
  const [obreroEstadoResidencia, setObreroEstadoResidencia] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [objetoContrato, setObjetoContrato] = useState('');
  const [jornada, setJornada] = useState<'DIURNA' | 'NOCTURNA' | 'MIXTA'>('DIURNA');
  const [fechaIngreso, setFechaIngreso] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [horarioDetalleCuarta, setHorarioDetalleCuarta] = useState('');
  const handleHorarioDetalle = useCallback((t: string) => {
    setHorarioDetalleCuarta(t);
  }, []);

  const [sueldoBase, setSueldoBase] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let c = true;
    (async () => {
      const [p, n] = await Promise.all([
        supabase.from('ci_proyectos').select('id,nombre').order('nombre'),
        supabase
          .from('ci_config_nomina')
          .select('id,cargo_nombre,salario_base_mensual,cestaticket_mensual,cargo_codigo,nivel_salarial')
          .order('cargo_nombre'),
      ]);
      if (!c) return;
      if (!p.error && p.data) setProyectos(p.data as ProyectoOpt[]);
      if (!n.error && n.data) setNominas(n.data as NominaRow[]);
      setLoadingLists(false);
    })();
    return () => {
      c = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!proyectoId) {
      setProyectoDetalle(null);
      return;
    }
    let c = true;
    (async () => {
      const full = await supabase
        .from('ci_proyectos')
        .select('id,nombre,entidad_id,horario_semanal_obra_default,ci_entidades(nombre,rif)')
        .eq('id', proyectoId)
        .maybeSingle();
      if (!c) return;
      if (!full.error && full.data) {
        setProyectoDetalle(full.data as ProyectoDetalle);
        return;
      }
      const lite = await supabase
        .from('ci_proyectos')
        .select('id,nombre,entidad_id,horario_semanal_obra_default')
        .eq('id', proyectoId)
        .maybeSingle();
      if (!c) return;
      setProyectoDetalle((lite.data as ProyectoDetalle) ?? null);
    })();
    return () => {
      c = false;
    };
  }, [proyectoId, supabase]);

  useEffect(() => {
    const eid = proyectoDetalle?.entidad_id?.trim();
    if (eid) setEntidadPatronoId(eid);
    else setEntidadPatronoId('');
  }, [proyectoDetalle?.entidad_id]);

  useEffect(() => {
    if (!configNominaId) {
      setSueldoBase(null);
      return;
    }
    const row = nominas.find((r) => r.id === configNominaId);
    if (!row) {
      setSueldoBase(null);
      return;
    }
    const sm = Number(row.salario_base_mensual);
    setSueldoBase(Number.isFinite(sm) && sm > 0 ? sm : null);
  }, [configNominaId, nominas]);

  const cfgTabulador: ConfigNominaTabuladorLike | null = useMemo(() => {
    const row = nominas.find((r) => r.id === configNominaId);
    if (!row) return null;
    const sm = Number(row.salario_base_mensual);
    const ce = Number(row.cestaticket_mensual ?? 0);
    if (!Number.isFinite(sm) || sm <= 0) return null;
    return {
      id: row.id,
      cargo_codigo: row.cargo_codigo ?? null,
      nivel_salarial: row.nivel_salarial ?? null,
      salario_base_mensual: sm,
      cestaticket_mensual: Number.isFinite(ce) && ce >= 0 ? ce : 0,
    };
  }, [configNominaId, nominas]);

  const salarioSemanalBs = cfgTabulador ? salarioBaseSemanalBolivares(cfgTabulador) : 0;
  const ingresoSemanalUsdRef = cfgTabulador ? ingresoSemanalConsolidadoUsdDesdeConfigNominaCestaticketUsd40(cfgTabulador) : null;

  const pagoSemanalBcV = useMemo(() => {
    const t = tasaBcvVesPorUsdFromEnv();
    if (cfgTabulador == null || t == null) {
      return { tasa: null as number | null, cestaBs: null as number | null, totalBs: null as number | null };
    }
    const cestaBs = cestaticketSemanalBolivaresAlTipoCambioBcV(t);
    const sal = salarioBaseSemanalBolivares(cfgTabulador);
    return { tasa: t, cestaBs, totalBs: Math.round((sal + cestaBs) * 100) / 100 };
  }, [cfgTabulador]);

  const nacionalidadEnvio = esVenezolano
    ? 'Venezolano'
    : nacionalidadOtro.trim() || null;

  const bonoNum = useMemo(() => {
    const t = bonoStr.replace(',', '.').trim();
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [bonoStr]);

  const bonoRefInfo = useMemo(() => {
    const t = tasaBcvVesPorUsdFromEnv();
    if (t == null) return { tasa: null as number | null, bonoBs: null as number | null };
    return { tasa: t, bonoBs: bonoUsdABs(bonoNum, t) };
  }, [bonoNum]);

  const entidadObra = entidadDesdeProyecto(proyectoDetalle);

  async function generar() {
    setErr(null);
    setOkMsg(null);
    setSignedUrl(null);
    if (!proyectoId || !configNominaId) {
      setErr('Seleccione proyecto y oficio del tabulador.');
      return;
    }
    if (!entidadPatronoId.trim()) {
      setErr(
        'Este proyecto no tiene entidad vinculada en la obra. Asígnela en el proyecto o en Configuración → entidades.',
      );
      return;
    }
    if (!nombres.trim() || !apellidos.trim()) {
      setErr('Nombres y apellidos del trabajador son obligatorios.');
      return;
    }
    if (!cedula.trim()) {
      setErr('La cédula es obligatoria.');
      return;
    }
    if (!esVenezolano && !nacionalidadOtro.trim()) {
      setErr('Si no es venezolano, indique la nacionalidad.');
      return;
    }
    const cedulaLimpia = normCedulaToken(cedula);
    if (!CEDULA_VE_NORMALIZADA_REGEX.test(cedulaLimpia)) {
      toast.error('Formato de cédula inválido (Ej: V-12345678)');
      return;
    }
    if (!horarioDetalleCuarta.trim()) {
      setErr('Configure el horario semanal (marque al menos un día).');
      return;
    }
    if (!obreroMunicipioResidencia.trim() || !obreroEstadoResidencia.trim()) {
      setErr('Indique municipio y estado de residencia del trabajador (comparecencia en el contrato).');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/talento/contratos-fast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          config_nomina_id: configNominaId,
          entidad_patrono_id: entidadPatronoId.trim(),
          obrero_nombres: nombres.trim(),
          obrero_apellidos: apellidos.trim(),
          obrero_cedula: cedulaLimpia,
          obrero_direccion: direccion.trim() || null,
          bono_manual_usd: bonoNum,
          fecha_ingreso: fechaIngreso,
          objeto_contrato: objetoContrato.trim() || null,
          jornada_trabajo: jornada,
          nacionalidad: nacionalidadEnvio,
          estado_civil: estadoCivil.trim() || null,
          horario_semanal_texto: horarioDetalleCuarta.trim(),
          obrero_municipio_residencia: obreroMunicipioResidencia.trim(),
          obrero_estado_residencia: obreroEstadoResidencia.trim(),
        }),
      });

      const rawBody = await res.text();
      let data: {
        error?: string;
        hint?: string;
        id?: string;
        expediente_label?: string;
        signed_url?: string | null;
        signed_url_error?: string | null;
        pdf_storage_path?: string;
        details?: Record<string, string[] | undefined>;
      };
      try {
        data = rawBody ? (JSON.parse(rawBody) as typeof data) : {};
      } catch {
        const snippet = rawBody.slice(0, 280).replace(/\s+/g, ' ').trim();
        setErr(
          `La respuesta no es JSON válido (HTTP ${res.status}). Suele pasar si el servidor devolvió una página de error HTML.\n\n` +
            (snippet
              ? `Fragmento: ${snippet}${snippet.length >= 280 ? '…' : ''}`
              : 'Revisa la terminal donde corre `npm run dev` y que `SUPABASE_SERVICE_ROLE_KEY` esté en `.env.local`.'),
        );
        return;
      }

      if (!res.ok) {
        const detalleCampos =
          data.details && typeof data.details === 'object'
            ? Object.entries(data.details)
                .filter(([, v]) => Array.isArray(v) && v.length)
                .map(([k, v]) => `${k}: ${(v as string[]).join(' ')}`)
                .join(' · ')
            : '';
        const msg = [data.error, data.hint, detalleCampos].filter(Boolean).join('\n\n');
        setErr(msg || 'Error al generar');
        return;
      }
      setOkMsg(
        `Contrato generado (${data.expediente_label ?? data.id?.slice(0, 8) ?? '—'}). Ruta: ${data.pdf_storage_path ?? '—'}`,
      );
      if (data.signed_url) {
        setSignedUrl(data.signed_url);
        window.open(data.signed_url, '_blank', 'noopener,noreferrer');
      } else if (data.signed_url_error) {
        toast.warning('Contrato guardado; no se pudo abrir el PDF automáticamente', {
          description: data.signed_url_error,
        });
      }
      toast.success('Contrato express guardado', {
        description: `${data.expediente_label ?? data.id?.slice(0, 12) ?? '—'} · PDF en almacenamiento; gestión (enlace, firmado, borrar) desde el módulo del proyecto (pestaña Solicitados) o Contratos admin.`,
      });
      router.push('/talento/admin/contratos');
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const failedFetch =
        m === 'Failed to fetch' ||
        m.includes('NetworkError') ||
        m.includes('Network request failed') ||
        m === 'Load failed';
      setErr(
        failedFetch
          ? 'No se pudo conectar con el servidor (Failed to fetch). Comprueba que `npm run dev` esté en marcha, que entres por la misma URL (p. ej. http://localhost:3000) y que ningún bloqueador esté cortando la petición.'
          : `Error de red: ${m}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28">
      <div className="mb-6 flex flex-wrap gap-3 text-xs">
        <Link href="/talento" className="text-zinc-500 hover:text-zinc-300">
          ← Talento
        </Link>
        <Link href="/talento/admin/contratos" className="text-zinc-500 hover:text-zinc-300">
          Contratos dinámicos
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Contrato express (sin registro)</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Elige la obra y el oficio del tabulador; los salarios salen del tabulador. Completa datos del trabajador, jornada y
        horario semanal (con viernes distinto si aplica). Al generar, el PDF se guarda en{' '}
        <code className="text-zinc-500">contratos_obreros</code> y la fila en{' '}
        <code className="text-zinc-500">ci_contratos_express</code>. En el módulo integral del proyecto (pestaña
        Solicitados) aparece el cuadro de express para enlace, imprimir, subir firmado o borrar.
      </p>

      {loadingLists ? (
        <p className="text-sm text-zinc-500">Cargando proyectos y tabulador…</p>
      ) : (
        <div className="space-y-4 text-sm">
          <label className="block">
            <span className="text-zinc-400">Proyecto (obra)</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {proyectoId && proyectoDetalle ? (
            <div className="rounded-lg border border-zinc-700/80 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
              <p>
                <span className="text-zinc-500">Obra: </span>
                <span className="font-medium text-white">{proyectoDetalle.nombre}</span>
              </p>
              <p className="mt-1">
                <span className="text-zinc-500">Entidad enlazada al proyecto: </span>
                {entidadObra?.nombre ? (
                  <span className="font-medium text-emerald-200/90">
                    {entidadObra.nombre}
                    {entidadObra.rif ? ` · ${entidadObra.rif}` : ''}
                  </span>
                ) : (
                  <span className="text-amber-200/80">Sin entidad en el proyecto (revisa entidad_id en la obra).</span>
                )}
              </p>
            </div>
          ) : null}

          <label className="block">
            <span className="text-zinc-400">OFICIO (TABULADOR)</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={configNominaId}
              onChange={(e) => setConfigNominaId(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {nominas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.cargo_nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-emerald-50/95">
            <p className="text-xs uppercase tracking-wide text-emerald-200/70 mb-1">Salario y pago semanal (referencia)</p>
            <p className="text-sm tabular-nums">
              <span className="text-zinc-400">Salario base mensual tabulador (Bs):</span>{' '}
              <span className="font-semibold text-white">{fmtBs(sueldoBase ?? 0)}</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Cestaticket mensual de ley: {fmtUsd(CESTATICKET_MENSUAL_USD)} (alícuota semanal {fmtUsd(CESTATICKET_SEMANAL_USD)}).
            </p>
            <p className="text-sm tabular-nums mt-1">
              <span className="text-zinc-400">Salario semanal (solo tabulador, Bs):</span>{' '}
              <span className="font-semibold text-emerald-200">{fmtBs(salarioSemanalBs)}</span>
            </p>
            {pagoSemanalBcV.tasa != null && pagoSemanalBcV.cestaBs != null && pagoSemanalBcV.totalBs != null ? (
              <>
                <p className="text-sm tabular-nums mt-1">
                  <span className="text-zinc-400">
                    Alícuota cesta ticket semanal ({fmtUsd(CESTATICKET_SEMANAL_USD)} a tasa BCV ref. {fmtBs(pagoSemanalBcV.tasa)}{' '}
                    Bs/USD, día de pago):
                  </span>{' '}
                  <span className="font-semibold text-emerald-200">{fmtBs(pagoSemanalBcV.cestaBs)} Bs</span>
                </p>
                <p className="text-sm tabular-nums mt-1">
                  <span className="text-zinc-400">Total semanal referencia (salario Bs + cesta en Bs):</span>{' '}
                  <span className="font-semibold text-white">{fmtBs(pagoSemanalBcV.totalBs)} Bs</span>
                </p>
              </>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-1">
                Para el equivalente en Bs del cestaticket (10 USD), define{' '}
                <code className="text-zinc-600">NEXT_PUBLIC_TASA_BCV_VES_POR_USD</code> con la tasa del día de pago.
              </p>
            )}
            {ingresoSemanalUsdRef != null && Number.isFinite(ingresoSemanalUsdRef) ? (
              <p className="text-sm tabular-nums mt-1">
                <span className="text-zinc-400">Ingreso semanal consolidado ref. (USD, Gaceta + 10 USD cesta/semana):</span>{' '}
                <span className="font-semibold text-sky-200">{fmtUsd(ingresoSemanalUsdRef)}</span>
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-1">No se pudo inferir el nivel Gaceta para el USD de referencia.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-zinc-400">Nombres</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                autoComplete="given-name"
              />
            </label>
            <label className="block">
              <span className="text-zinc-400">Apellidos</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                autoComplete="family-name"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-zinc-400">Cédula</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={esVenezolano}
              onChange={(e) => {
                setEsVenezolano(e.target.checked);
                if (e.target.checked) setNacionalidadOtro('');
              }}
              className="rounded border-zinc-500"
            />
            Es venezolano
          </label>
          {!esVenezolano ? (
            <label className="block">
              <span className="text-zinc-400">Nacionalidad</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                value={nacionalidadOtro}
                onChange={(e) => setNacionalidadOtro(e.target.value)}
                placeholder="Ej. colombiana"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-zinc-400">Domicilio (calle, urbanización, ciudad…)</span>
            <textarea
              className="mt-1 w-full min-h-[72px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Urbanización, calle, ciudad…"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-zinc-400">Municipio de residencia *</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                value={obreroMunicipioResidencia}
                onChange={(e) => setObreroMunicipioResidencia(e.target.value)}
                placeholder="Ej. Maneiro"
                autoComplete="address-level2"
              />
            </label>
            <label className="block">
              <span className="text-zinc-400">Estado de residencia *</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                value={obreroEstadoResidencia}
                onChange={(e) => setObreroEstadoResidencia(e.target.value)}
                placeholder="Ej. Nueva Esparta"
                autoComplete="address-level1"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-zinc-400">Bono manual (USD)</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={bonoStr}
              onChange={(e) => setBonoStr(e.target.value)}
              inputMode="decimal"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Se liquida en bolívares en cada pago usando la tasa BCV del día.
            </span>
          </label>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-100/90">
            <p className="text-xs uppercase tracking-wide text-amber-200/70 mb-1">Referencia bono</p>
            <p className="text-sm tabular-nums">
              <span className="text-zinc-400">Bono (USD):</span>{' '}
              <span className="font-semibold text-amber-200">{fmtUsd(bonoNum)}</span>
            </p>
            {bonoRefInfo.bonoBs != null && bonoRefInfo.tasa != null ? (
              <p className="text-sm tabular-nums mt-1">
                <span className="text-zinc-400">Equivalente en Bs (tasa ref. {fmtBs(bonoRefInfo.tasa)} Bs/USD):</span>{' '}
                <span className="font-semibold text-emerald-300">{fmtBs(bonoRefInfo.bonoBs)} Bs</span>
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-2">
                Para equivalente en Bs, define <code className="text-zinc-600">NEXT_PUBLIC_TASA_BCV_VES_POR_USD</code>.
              </p>
            )}
          </div>

          <label className="block">
            <span className="text-zinc-400">Fecha de ingreso</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white [color-scheme:dark]"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-zinc-400">Jornada de trabajo</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={jornada}
              onChange={(e) => setJornada(e.target.value as typeof jornada)}
            >
              <option value="DIURNA">Diurna</option>
              <option value="NOCTURNA">Nocturna</option>
              <option value="MIXTA">Mixta</option>
            </select>
          </label>

          <HorarioSemanalExpressForm
            onChange={handleHorarioDetalle}
            hintProyecto={proyectoDetalle?.horario_semanal_obra_default ?? null}
          />

          <label className="block">
            <span className="text-zinc-400">Estado civil (opcional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={estadoCivil}
              onChange={(e) => setEstadoCivil(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-zinc-400">Objeto del contrato / fase técnica (opcional)</span>
            <textarea
              className="mt-1 w-full min-h-[88px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={objetoContrato}
              onChange={(e) => setObjetoContrato(e.target.value)}
            />
          </label>

          {err ? <p className="text-sm text-red-400 whitespace-pre-wrap break-words">{err}</p> : null}
          {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}
          {signedUrl ? (
            <p>
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 underline"
              >
                Descargar PDF (enlace firmado 1 h)
              </a>
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void generar()}
            className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 disabled:opacity-50"
          >
            {saving ? 'Generando…' : 'Generar contrato'}
          </button>
        </div>
      )}
    </div>
  );
}
