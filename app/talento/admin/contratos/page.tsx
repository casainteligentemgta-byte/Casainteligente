'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Emp = { id: string; nombre_completo: string; estado: string };

export default function ContratosAdminPage() {
  const supabase = createClient();
  const [empleados, setEmpleados] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [tipoPlazo, setTipoPlazo] = useState<'DETERMINADO' | 'INDETERMINADO'>('INDETERMINADO');
  const [jornada, setJornada] = useState<'DIURNA' | 'NOCTURNA' | 'MIXTA'>('DIURNA');
  const [texto, setTexto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = true;
    (async () => {
      const e = await supabase.from('ci_empleados').select('id,nombre_completo,estado').eq('estado', 'aprobado').order('nombre_completo');
      if (!c) return;
      if (!e.error && e.data) setEmpleados(e.data as Emp[]);
      setLoading(false);
    })();
    return () => {
      c = false;
    };
  }, [supabase]);

  async function generar() {
    setErr(null);
    setTexto(null);
    setSaving(true);
    try {
      const res = await fetch('/api/talento/contratos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empId,
          fecha_ingreso: fechaIngreso,
          tipoPlazo,
          jornada_trabajo: jornada,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Error');
        return;
      }
      setTexto((data.contrato as string) ?? null);
    } catch {
      setErr('Error de red');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-28">
      <div className="mb-6 flex flex-wrap gap-3 text-xs">
        <Link href="/talento" className="text-zinc-500 hover:text-zinc-300">
          ← Talento
        </Link>
        <Link href="/talento/admin/documentos" className="text-[#FF9500] hover:text-[#FFD60A]">
          Biblioteca de documentos
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Contratos dinámicos</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Selecciona un empleado <strong className="text-zinc-300">aprobado</strong> y genera el borrador del contrato individual
        de trabajo usando la plantilla legal vigente.
      </p>

      {loading ? (
        <p className="text-zinc-500 text-sm">Cargando datos…</p>
      ) : (
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Empleado</label>
            <select
              className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {empleados.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre_completo}
                </option>
              ))}
            </select>
            {empleados.length === 0 && (
              <p className="text-xs text-amber-500/90 mt-2">No hay empleados aprobados. Completa un examen con semáforo verde/amarillo.</p>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Fecha de ingreso</label>
              <input
                type="date"
                className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm [color-scheme:dark]"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Tipo de plazo</label>
              <select
                className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                value={tipoPlazo}
                onChange={(e) => setTipoPlazo(e.target.value as 'DETERMINADO' | 'INDETERMINADO')}
              >
                <option value="INDETERMINADO">Indeterminado</option>
                <option value="DETERMINADO">Determinado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Jornada</label>
              <select
                className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                value={jornada}
                onChange={(e) => setJornada(e.target.value as 'DIURNA' | 'NOCTURNA' | 'MIXTA')}
              >
                <option value="DIURNA">Diurna</option>
                <option value="MIXTA">Mixta</option>
                <option value="NOCTURNA">Nocturna</option>
              </select>
            </div>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button
            type="button"
            disabled={saving || !empId}
            onClick={() => void generar()}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold py-3 text-sm"
          >
            {saving ? 'Generando…' : 'Generar y guardar contrato'}
          </button>
        </div>
      )}

      {texto && (
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-black/60 p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-300">Vista previa (Markdown)</h2>
          </div>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-[480px] overflow-y-auto">
            {texto}
          </pre>
        </div>
      )}
    </div>
  );
}
