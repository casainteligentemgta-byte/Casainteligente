import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CiEntidad } from '@/types/ci-entidad';

export default async function EntidadesPage() {
  let entidades: CiEntidad[] = [];
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error: e } = await supabase.from('ci_entidades').select('*').order('nombre');
    if (e) error = e.message;
    else if (data) entidades = data as CiEntidad[];
  } catch (err) {
    error = err instanceof Error ? err.message : 'Error al conectar';
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-slate-900">
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Vista ampliada de patronos (logo, mercantil, permisología):{' '}
        <Link href="/configuracion/entidades" className="font-semibold text-amber-800 underline hover:text-amber-950">
          Configuración → Entidades
        </Link>
        .
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/proyectos/modulo" className="text-sm font-medium text-sky-600 hover:text-sky-500">
            ← Proyectos
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Entidades de trabajo</h1>
          <p className="mt-1 text-sm text-slate-600">
            Razón social y RIF del patrono. Se asocian a proyectos del módulo integral y aparecen en la planilla de empleo
            (PDF).
          </p>
        </div>
        <Link
          href="/entidades/nueva"
          className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-500"
        >
          Nueva entidad
        </Link>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}. Si la tabla no existe, ejecuta en Supabase{' '}
          <code className="rounded bg-red-100 px-1">supabase/migrations/063_ci_entidades_proyecto_empleado.sql</code>.
        </p>
      ) : null}

      {!error && entidades.length === 0 ? (
        <p className="text-slate-500">No hay entidades. Crea la primera con «Nueva entidad».</p>
      ) : null}

      {!error && entidades.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-700">Nombre</th>
                <th className="px-4 py-3 font-semibold text-slate-700">RIF</th>
                <th className="px-4 py-3 font-semibold text-slate-700 w-28"> </th>
              </tr>
            </thead>
            <tbody>
              {entidades.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{r.rif?.trim() || '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/entidades/${r.id}`} className="font-semibold text-sky-600 hover:text-sky-500">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
