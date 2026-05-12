'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';

type ProyectoOpt = { id: string; nombre: string };
type NominaRow = { id: string; cargo_nombre: string; salario_base_mensual: number | string | null };

const fmtBs = (n: number) =>
  new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function ContratoExpressCreatePage() {
  const supabase = useMemo(() => createClient(), []);
  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [nominas, setNominas] = useState<NominaRow[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [proyectoId, setProyectoId] = useState('');
  const [configNominaId, setConfigNominaId] = useState('');
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [bonoStr, setBonoStr] = useState('0');
  const [direccion, setDireccion] = useState('');
  const [nacionalidad, setNacionalidad] = useState('Venezolano');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [objetoContrato, setObjetoContrato] = useState('');
  const [jornada, setJornada] = useState<'DIURNA' | 'NOCTURNA' | 'MIXTA'>('DIURNA');
  const [fechaIngreso, setFechaIngreso] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

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
        supabase.from('ci_config_nomina').select('id,cargo_nombre,salario_base_mensual').order('cargo_nombre'),
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

  const bonoNum = useMemo(() => {
    const t = bonoStr.replace(',', '.').trim();
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [bonoStr]);

  const totalReferencia = (sueldoBase ?? 0) + bonoNum;

  async function generar() {
    setErr(null);
    setOkMsg(null);
    setSignedUrl(null);
    if (!proyectoId || !configNominaId) {
      setErr('Seleccione proyecto y cargo del tabulador.');
      return;
    }
    if (!nombre.trim() || !cedula.trim()) {
      setErr('Nombre y cédula son obligatorios.');
      return;
    }
    /** Misma lógica que API: quitar `.`, espacios, `-` y pasar a mayúsculas → p. ej. `V12345678`. */
    const cedulaLimpia = normCedulaToken(cedula);
    if (!CEDULA_VE_NORMALIZADA_REGEX.test(cedulaLimpia)) {
      toast.error('Formato de cédula inválido (Ej: V-12345678)');
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
          obrero_nombre: nombre.trim(),
          obrero_cedula: cedulaLimpia,
          obrero_direccion: direccion.trim() || null,
          bono_manual_ves: bonoNum,
          fecha_ingreso: fechaIngreso,
          objeto_contrato: objetoContrato.trim() || null,
          jornada_trabajo: jornada,
          nacionalidad: nacionalidad.trim() || null,
          estado_civil: estadoCivil.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        id?: string;
        expediente_label?: string;
        signed_url?: string | null;
        pdf_storage_path?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? 'Error al generar');
        return;
      }
      setOkMsg(
        `Contrato generado (${data.expediente_label ?? data.id?.slice(0, 8) ?? '—'}). Ruta: ${data.pdf_storage_path ?? '—'}`,
      );
      if (data.signed_url) setSignedUrl(data.signed_url);
    } catch {
      setErr('Error de red');
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
        <Link href="/talento/admin/contratos/fast-list" className="text-zinc-500 hover:text-zinc-300">
          Listado express
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Contrato express (sin registro)</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Completa los datos manuales, elige proyecto y cargo del tabulador. Se genera el PDF estructurado, se guarda en{' '}
        <code className="text-zinc-500">contratos_obreros</code> y queda registro en{' '}
        <code className="text-zinc-500">ci_contratos_express</code>.
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

          <label className="block">
            <span className="text-zinc-400">Cargo (tabulador)</span>
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

          <label className="block">
            <span className="text-zinc-400">Nombre completo</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="name"
            />
          </label>

          <label className="block">
            <span className="text-zinc-400">Cédula</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="text-zinc-400">Dirección (opcional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-zinc-400">Bono manual (VES, referencia mensual)</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={bonoStr}
              onChange={(e) => setBonoStr(e.target.value)}
              inputMode="decimal"
            />
          </label>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-100/90">
            <p className="text-xs uppercase tracking-wide text-amber-200/70 mb-1">Total referencia (antes de generar)</p>
            <p className="text-lg font-semibold tabular-nums">
              <span>{fmtBs(sueldoBase ?? 0)}</span>
              <span className="text-zinc-500 font-normal mx-2">+</span>
              <span>{fmtBs(bonoNum)}</span>
              <span className="text-zinc-500 font-normal mx-2">=</span>
              <span>{fmtBs(totalReferencia)} Bs</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              El sueldo base proviene del tabulador; el bono queda en el registro express (referencia administrativa).
            </p>
          </div>

          <label className="block">
            <span className="text-zinc-400">Fecha de ingreso</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-zinc-400">Jornada</span>
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

          <label className="block">
            <span className="text-zinc-400">Nacionalidad</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
              value={nacionalidad}
              onChange={(e) => setNacionalidad(e.target.value)}
            />
          </label>

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

          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}
          {signedUrl ? (
            <p>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">
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
