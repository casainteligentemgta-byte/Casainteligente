'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Briefcase, 
  User, 
  Banknote, 
  Clock, 
  MapPin, 
  Calendar, 
  ChevronLeft, 
  Save,
  CheckCircle2,
  Info,
  Building2,
  FileText,
  BadgeInfo,
  DollarSign,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
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
import {
  bonoUsdDesdeAsignacionObrero,
  idsObrerosConContratoSuscrito,
} from '@/lib/rrhh/obreroContratoSuscrito';
import { formatBonoUsd } from '@/lib/rrhh/projectAssignmentBono';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';
import { HorarioSemanalExpressForm } from './HorarioSemanalExpressForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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
  const [activeTab, setActiveTab] = useState('datos');

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
  /** Contrato ya suscrito: el bono del express no se edita aquí (venía de la asignación). */
  const [bonoBloqueado, setBonoBloqueado] = useState(false);
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
      
      // Handle Copy Logic
      const url = new URL(window.location.href);
      const copyId = url.searchParams.get('copy');
      if (copyId) {
        const { data: copyData, error: copyErr } = await supabase
          .from('ci_contratos_express')
          .select('*')
          .eq('id', copyId)
          .maybeSingle();
        
        if (!copyErr && copyData && c) {
          setProyectoId(copyData.proyecto_id || '');
          setConfigNominaId(copyData.config_nomina_id || '');
          setNombres(copyData.obrero_nombres || '');
          setApellidos(copyData.obrero_apellidos || '');
          setCedula(copyData.obrero_cedula || '');
          setDireccion(copyData.obrero_direccion || '');
          setObreroMunicipioResidencia(copyData.obrero_municipio_residencia || '');
          setObreroEstadoResidencia(copyData.obrero_estado_residencia || '');
          setBonoStr(String(copyData.bono_manual_usd || '0'));
          setObjetoContrato(copyData.objeto_contrato || '');
          setJornada(copyData.jornada_trabajo || 'DIURNA');
          setEstadoCivil(copyData.estado_civil || '');
          
          if (copyData.nacionalidad) {
            if (copyData.nacionalidad.toLowerCase().includes('venezolan')) {
              setEsVenezolano(true);
            } else {
              setEsVenezolano(false);
              setNacionalidadOtro(copyData.nacionalidad);
            }
          }
          
          toast.info('Datos copiados del contrato seleccionado');
        }
      } else {
        const workerId = (url.searchParams.get('worker') || url.searchParams.get('empleado') || '').trim();
        const proyectoParam = (url.searchParams.get('proyecto') || '').trim();
        if (workerId && c) {
          const { data: emp } = await supabase
            .from('ci_empleados')
            .select('id,nombre_completo,cedula,documento')
            .eq('id', workerId)
            .maybeSingle();
          if (emp && c) {
            const nom = String((emp as { nombre_completo?: string }).nombre_completo ?? '').trim();
            const parts = nom.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              setNombres(parts.slice(0, -1).join(' '));
              setApellidos(parts[parts.length - 1]!);
            } else if (parts.length === 1) {
              setNombres(parts[0]!);
            }
            const ced = String(
              (emp as { cedula?: string; documento?: string }).cedula ??
                (emp as { documento?: string }).documento ??
                '',
            ).trim();
            if (ced) setCedula(ced);
          }
          if (proyectoParam) setProyectoId(proyectoParam);
          const bono = await bonoUsdDesdeAsignacionObrero(
            supabase,
            workerId,
            proyectoParam ? [proyectoParam] : undefined,
          );
          if (c && bono > 0) setBonoStr(formatBonoUsd(bono));
          const locked = await idsObrerosConContratoSuscrito(supabase, [workerId]);
          if (c) setBonoBloqueado(locked.has(workerId));
        }
      }

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
      router.push('/talento/admin/contratos/fast-list');
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
    <div className="min-h-screen bg-black text-zinc-100 pb-20 animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Navigation / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-4">
              <Link href="/talento/admin/contratos/fast-list">
                <Button variant="ghost" size="sm" className="h-8 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 px-2">
                  <ChevronLeft className="size-4 mr-1" />
                  Volver a la lista
                </Button>
              </Link>
              <div className="h-4 w-px bg-white/10" />
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Modo Fast-Track
              </Badge>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter">Generar Contrato Express</h1>
            <p className="text-zinc-500 text-sm font-medium">Creación de registro laboral sin expediente previo para despliegue rápido.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="size-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center shadow-2xl">
                <FileText className="size-6 text-zinc-400" />
             </div>
          </div>
        </div>

        {loadingLists ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full animate-pulse" />
              <Clock className="size-12 text-amber-500 animate-spin relative" />
            </div>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Sincronizando infraestructuras...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-4 h-14 bg-zinc-900/50 border border-white/5 rounded-2xl p-1 mb-8 backdrop-blur-md">
                <TabsTrigger value="datos" className="rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold uppercase tracking-wider">
                  <User className="size-4 mr-2" />
                  Identidad
                </TabsTrigger>
                <TabsTrigger value="pago" className="rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold uppercase tracking-wider">
                  <Banknote className="size-4 mr-2" />
                  Condiciones
                </TabsTrigger>
                <TabsTrigger value="horario" className="rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold uppercase tracking-wider">
                  <Clock className="size-4 mr-2" />
                  Horario
                </TabsTrigger>
                <TabsTrigger value="revisar" className="rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="size-4 mr-2" />
                  Revisar
                </TabsTrigger>
              </TabsList>

              <div className="min-h-[500px]">
                {/* TAB 1: IDENTIDAD */}
                <TabsContent value="datos" className="mt-0 space-y-6 focus-visible:outline-none">
                  <Card className="bg-zinc-900/40 border-white/5 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="size-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Building2 className="size-4" />
                        </div>
                        <CardTitle className="text-xl font-black tracking-tight">Ubicación y Oficio</CardTitle>
                      </div>
                      <CardDescription className="text-zinc-500 font-medium">Asigne el proyecto y el cargo según el tabulador oficial.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Proyecto (Obra)</Label>
                          <select
                            className="w-full h-12 rounded-2xl border border-white/5 bg-black/40 px-4 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/10 transition-all outline-none appearance-none"
                            value={proyectoId}
                            onChange={(e) => setProyectoId(e.target.value)}
                          >
                            <option value="">Seleccionar Obra...</option>
                            {proyectos.map((p) => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Oficio (Tabulador)</Label>
                          <select
                            className="w-full h-12 rounded-2xl border border-white/5 bg-black/40 px-4 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/10 transition-all outline-none appearance-none"
                            value={configNominaId}
                            onChange={(e) => setConfigNominaId(e.target.value)}
                          >
                            <option value="">Seleccionar Oficio...</option>
                            {nominas.map((r) => (
                              <option key={r.id} value={r.id}>{r.cargo_nombre}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {proyectoId && proyectoDetalle && (
                        <div className="p-4 rounded-2xl bg-zinc-800/30 border border-white/5 flex items-start gap-4">
                          <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 mt-1">
                            <Info className="size-5" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-1">Entidad Patrona Detectada</p>
                            {entidadObra?.nombre ? (
                              <div className="space-y-0.5">
                                <p className="text-white font-bold">{entidadObra.nombre}</p>
                                <p className="text-[10px] text-zinc-500 font-mono uppercase">RIF: {entidadObra.rif || 'N/A'}</p>
                              </div>
                            ) : (
                              <p className="text-amber-500/80 text-xs font-bold">Sin entidad vinculada. Revisa la configuración del proyecto.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900/40 border-white/5 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="size-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <User className="size-4" />
                        </div>
                        <CardTitle className="text-xl font-black tracking-tight">Datos del Colaborador</CardTitle>
                      </div>
                      <CardDescription className="text-zinc-500 font-medium">Información de identificación y contacto del trabajador.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Nombres</Label>
                          <Input 
                            value={nombres} 
                            onChange={(e) => setNombres(e.target.value)} 
                            className="h-12 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50" 
                            placeholder="Ej. Juan Carlos"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Apellidos</Label>
                          <Input 
                            value={apellidos} 
                            onChange={(e) => setApellidos(e.target.value)} 
                            className="h-12 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50" 
                            placeholder="Ej. Pérez García"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Cédula / ID</Label>
                          <Input 
                            value={cedula} 
                            onChange={(e) => setCedula(e.target.value)} 
                            className="h-12 bg-black/40 border-white/5 rounded-2xl font-mono focus:border-amber-500/50" 
                            placeholder="V-12345678"
                          />
                        </div>
                        <div className="space-y-2 flex flex-col justify-end">
                          <div className="flex items-center gap-4 h-12 px-4 rounded-2xl bg-black/20 border border-white/5">
                            <Label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-400 hover:text-white transition-colors">
                              <input
                                type="checkbox"
                                checked={esVenezolano}
                                onChange={(e) => {
                                  setEsVenezolano(e.target.checked);
                                  if (e.target.checked) setNacionalidadOtro('');
                                }}
                                className="size-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/20"
                              />
                              Venezolano
                            </Label>
                            {!esVenezolano && (
                              <Input 
                                value={nacionalidadOtro} 
                                onChange={(e) => setNacionalidadOtro(e.target.value)}
                                className="flex-1 h-8 bg-zinc-800/50 border-white/5 rounded-xl text-xs"
                                placeholder="Indique nacionalidad"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Dirección de Domicilio</Label>
                        <textarea
                          className="w-full min-h-[80px] rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/10 transition-all outline-none"
                          value={direccion}
                          onChange={(e) => setDireccion(e.target.value)}
                          placeholder="Calle, urbanización, casa, punto de referencia..."
                        />
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Municipio de Residencia</Label>
                          <Input 
                            value={obreroMunicipioResidencia} 
                            onChange={(e) => setObreroMunicipioResidencia(e.target.value)} 
                            className="h-12 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50" 
                            placeholder="Ej. Maneiro"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Estado de Residencia</Label>
                          <Input 
                            value={obreroEstadoResidencia} 
                            onChange={(e) => setObreroEstadoResidencia(e.target.value)} 
                            className="h-12 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50" 
                            placeholder="Ej. Nueva Esparta"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end pt-4">
                    <Button onClick={() => setActiveTab('pago')} className="h-14 bg-white text-black hover:bg-zinc-200 font-black text-xs uppercase tracking-widest rounded-2xl px-10 shadow-xl shadow-white/5 border-0 transition-all hover:scale-105">
                      Siguiente: Condiciones
                    </Button>
                  </div>
                </TabsContent>

                {/* TAB 2: PAGO Y CONDICIONES */}
                <TabsContent value="pago" className="mt-0 space-y-6 focus-visible:outline-none">
                  <Card className="bg-zinc-900/40 border-white/5 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="size-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Banknote className="size-4" />
                        </div>
                        <CardTitle className="text-xl font-black tracking-tight">Condiciones Económicas</CardTitle>
                      </div>
                      <CardDescription className="text-zinc-500 font-medium">Salarios calculados automáticamente según tabulador y complementos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                           <div>
                            <p className="text-[10px] uppercase tracking-widest font-black text-emerald-500/70 mb-1">Salario Tabulador</p>
                            <p className="text-3xl font-black text-white tracking-tighter">
                              {fmtBs(sueldoBase ?? 0)} <span className="text-xs font-normal text-zinc-500 uppercase tracking-widest ml-1">Bs/Mes</span>
                            </p>
                           </div>
                           <div className="h-px bg-emerald-500/10 w-full" />
                           <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500">Semanal Base</span>
                                <span className="text-emerald-400 font-bold tabular-nums">{fmtBs(salarioSemanalBs)} Bs</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500">Cestaticket Semanal</span>
                                <span className="text-emerald-400 font-bold tabular-nums">{fmtBs(pagoSemanalBcV.cestaBs ?? 0)} Bs</span>
                              </div>
                              <div className="flex justify-between items-center text-sm pt-2 border-t border-emerald-500/5 font-black">
                                <span className="text-white">Total Semanal Bs</span>
                                <span className="text-white tabular-nums">{fmtBs(pagoSemanalBcV.totalBs ?? 0)} Bs</span>
                              </div>
                           </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">
                              Bono Manual Complementario (USD)
                            </Label>
                            {bonoBloqueado ? (
                              <p className="text-[10px] text-zinc-500">
                                Este obrero ya suscribió contrato: define el bono en la solicitud antes del express, o
                                revísalo en el contrato ya generado.
                              </p>
                            ) : (
                              <p className="text-[10px] text-zinc-600">
                                Editable antes de generar y suscribir el contrato express. Si viene de una asignación
                                RRHH, se precarga desde el cuadro de solicitados.
                              </p>
                            )}
                            <div className="relative group">
                              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                              <Input 
                                value={bonoStr} 
                                onChange={(e) => setBonoStr(e.target.value)} 
                                disabled={bonoBloqueado}
                                readOnly={bonoBloqueado}
                                className="h-14 pl-11 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-60" 
                                placeholder="0.00"
                                inputMode="decimal"
                              />
                            </div>
                          </div>

                          <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                            <BadgeInfo className="size-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                               <p className="text-[10px] uppercase tracking-widest font-black text-amber-500/70 mb-1">Referencia Bono en Bs</p>
                               <p className="text-lg font-bold text-white tabular-nums">
                                 {fmtBs(bonoRefInfo.bonoBs ?? 0)} <span className="text-[10px] font-normal text-zinc-500 uppercase tracking-widest ml-1">Ves</span>
                               </p>
                               <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-tighter">Calculado a tasa BCV: {fmtBs(bonoRefInfo.tasa ?? 0)} Bs/USD</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Fecha de Ingreso</Label>
                          <div className="relative group">
                             <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                             <Input 
                               type="date"
                               value={fechaIngreso} 
                               onChange={(e) => setFechaIngreso(e.target.value)} 
                               className="h-12 pl-11 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50 [color-scheme:dark]" 
                             />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Jornada de Trabajo</Label>
                          <select
                            className="w-full h-12 rounded-2xl border border-white/5 bg-black/40 px-4 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/10 transition-all outline-none appearance-none"
                            value={jornada}
                            onChange={(e) => setJornada(e.target.value as typeof jornada)}
                          >
                            <option value="DIURNA">Diurna</option>
                            <option value="NOCTURNA">Nocturna</option>
                            <option value="MIXTA">Mixta</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                         <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Estado Civil</Label>
                          <Input 
                            value={estadoCivil} 
                            onChange={(e) => setEstadoCivil(e.target.value)} 
                            className="h-12 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50" 
                            placeholder="Ej. Soltero, Casado..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 ml-1">Objeto / Fase Técnica</Label>
                          <Input 
                            value={objetoContrato} 
                            onChange={(e) => setObjetoContrato(e.target.value)} 
                            className="h-12 bg-black/40 border-white/5 rounded-2xl focus:border-amber-500/50" 
                            placeholder="Ej. Albañilería, Pintura..."
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={() => setActiveTab('datos')} className="h-14 rounded-2xl px-8 text-zinc-500 hover:text-white hover:bg-white/5 font-bold">
                      Volver
                    </Button>
                    <Button onClick={() => setActiveTab('horario')} className="h-14 bg-white text-black hover:bg-zinc-200 font-black text-xs uppercase tracking-widest rounded-2xl px-10 shadow-xl shadow-white/5 border-0 transition-all hover:scale-105">
                      Siguiente: Horario
                    </Button>
                  </div>
                </TabsContent>

                {/* TAB 3: HORARIO */}
                <TabsContent value="horario" className="mt-0 space-y-6 focus-visible:outline-none">
                  <Card className="bg-zinc-900/40 border-white/5 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="size-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Clock className="size-4" />
                        </div>
                        <CardTitle className="text-xl font-black tracking-tight">Distribución Horaria</CardTitle>
                      </div>
                      <CardDescription className="text-zinc-500 font-medium">Defina los días y franjas horarias de trabajo (Cláusula CUARTA).</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <HorarioSemanalExpressForm
                        onChange={handleHorarioDetalle}
                        hintProyecto={proyectoDetalle?.horario_semanal_obra_default ?? null}
                      />
                    </CardContent>
                  </Card>

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={() => setActiveTab('pago')} className="h-14 rounded-2xl px-8 text-zinc-500 hover:text-white hover:bg-white/5 font-bold">
                      Volver
                    </Button>
                    <Button onClick={() => setActiveTab('revisar')} className="h-14 bg-white text-black hover:bg-zinc-200 font-black text-xs uppercase tracking-widest rounded-2xl px-10 shadow-xl shadow-white/5 border-0 transition-all hover:scale-105">
                      Siguiente: Revisar
                    </Button>
                  </div>
                </TabsContent>

                {/* TAB 4: REVISAR Y GENERAR */}
                <TabsContent value="revisar" className="mt-0 space-y-6 focus-visible:outline-none">
                  <Card className="bg-zinc-900/40 border-white/5 rounded-[2.5rem] shadow-2xl backdrop-blur-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-8 py-6 border-b border-white/5">
                      <CardTitle className="text-2xl font-black tracking-tight text-white">Confirmación Final</CardTitle>
                      <CardDescription className="text-amber-500/70 font-bold uppercase tracking-widest text-[10px] mt-1">Verifique los datos antes de emitir el documento legal.</CardDescription>
                    </div>
                    <CardContent className="p-8 space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-6">
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Colaborador</p>
                              <p className="text-xl font-bold text-white uppercase">{nombres} {apellidos}</p>
                              <p className="text-xs font-mono text-zinc-400">{cedula}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Oficio y Obra</p>
                              <p className="text-white font-bold">{nominas.find(n => n.id === configNominaId)?.cargo_nombre || '—'}</p>
                              <p className="text-xs text-zinc-400">{proyectos.find(p => p.id === proyectoId)?.nombre || '—'}</p>
                            </div>
                          </div>

                          <div className="p-6 rounded-3xl bg-zinc-950/60 border border-white/5 space-y-4 shadow-inner">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Ingreso Estimado</span>
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{fmtUsd(ingresoSemanalUsdRef ?? 0)} USD/Sem</Badge>
                            </div>
                            <div className="space-y-2 pt-2">
                              <div className="flex justify-between text-xs text-zinc-400 font-medium">
                                <span>Salario Bs</span>
                                <span>{fmtBs(salarioSemanalBs)} Bs</span>
                              </div>
                              <div className="flex justify-between text-xs text-zinc-400 font-medium">
                                <span>Bono USD</span>
                                <span>{fmtUsd(bonoNum)} USD</span>
                              </div>
                              <div className="pt-2 border-t border-white/5 flex justify-between font-black text-white">
                                <span>Total Ref. Bs</span>
                                <span>{fmtBs((pagoSemanalBcV.totalBs || 0) + (bonoRefInfo.bonoBs || 0))} Bs</span>
                              </div>
                            </div>
                          </div>
                       </div>

                       <div className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-2">
                          <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Cláusula de Horario</p>
                          <p className="text-xs text-zinc-400 leading-relaxed italic">"{horarioDetalleCuarta || 'No configurado'}"</p>
                       </div>

                       {err && (
                         <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in shake duration-300">
                           <AlertTriangle className="size-5 text-red-500 shrink-0" />
                           <p className="text-xs text-red-400 font-bold leading-relaxed whitespace-pre-wrap">{err}</p>
                         </div>
                       )}

                       {okMsg && (
                         <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                           <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                           <p className="text-xs text-emerald-400 font-bold leading-relaxed">{okMsg}</p>
                         </div>
                       )}
                    </CardContent>
                  </Card>

                  <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4">
                    <Button variant="ghost" onClick={() => setActiveTab('horario')} className="w-full md:w-auto h-14 rounded-2xl px-8 text-zinc-500 hover:text-white hover:bg-white/5 font-bold">
                      Seguir Editando
                    </Button>
                    <Button 
                      disabled={saving}
                      onClick={() => void generar()}
                      className="w-full md:flex-1 h-16 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-sm uppercase tracking-[0.2em] rounded-[2rem] shadow-2xl shadow-orange-950/20 border-0 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="size-5 mr-3 animate-spin" />
                          Generando PDF...
                        </>
                      ) : (
                        <>
                          <Save className="size-5 mr-3" />
                          Generar y Emitir Contrato
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
