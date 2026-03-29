'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Emp = { id: string; nombre_completo: string; estado: string };
type Obra = { id: string; nombre: string };

export default function ContratosAdminPage() {
  const supabase = createClient();
  const [empleados, setEmpleados] = useState<Emp[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [empId, setEmpId] = useState('');
  const [obraId, setObraId] = useState('');
  const [monto, setMonto] = useState('');
  const [pct, setPct] = useState('30');
  const [texto, setTexto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = true;
    (async () => {
      const [e, o] = await Promise.all([
        supabase.from('ci_empleados').select('id,nombre_completo,estado').eq('estado', 'aprobado').order('nombre_completo'),
        supabase.from('ci_obras').select('id,nombre').order('nombre'),
      ]);
      if (!c) return;
      if (!e.error && e.data) setEmpleados(e.data as Emp[]);
      if (!o.error && o.data) setObras(o.data as Obra[]);
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
          obra_id: obraId,
          monto_acordado_usd: Number(monto.replace(',', '.')),
          porcentaje_inicial: Number(pct.replace(',', '.')),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Error');
        return;
      }
      setTexto(data.texto_legal as string);
    } catch {
      setErr('Error de red');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-28">
      <Link href="/talento" className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        ← Talento
      </Link>
      <h1 className="text-2xl font-bold text-white mb-2">Contratos dinámicos</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Selecciona un empleado <strong className="text-zinc-300">aprobado</strong> y una obra. Ajusta monto y porcentaje
        inicial. El texto sigue el modelo CENTAURO LAW (revisión legal recomendada).
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
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Obra</label>
            <select
              className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {obras.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
            {obras.length === 0 && (
              <p className="text-xs text-zinc-500 mt-2">Inserta obras en Supabase (tabla ci_obras) o desde SQL.</p>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Monto acordado (USD)</label>
              <input
                className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Porcentaje inicial (%)</label>
              <input
                className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
              />
            </div>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button
            type="button"
            disabled={saving || !empId || !obraId || !monto}
            onClick={() => void generar()}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold py-3 text-sm"
          >
            {saving ? 'Generando…' : 'Generar y guardar contrato'}
          </button>
        </div>
      )}

      {texto && (
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-black/60 p-6">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Vista previa</h2>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-[480px] overflow-y-auto">
            {texto}
          </pre>
        </div>
      )}
    </div>
  );
}
