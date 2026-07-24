import Link from 'next/link';
import { crearContratoExpedienteObraDigital } from './actions';

export default function ObraDigitalNuevoContratoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-lg">
        <Link href="/obra-digital" className="text-sm text-zinc-400 hover:text-white">
          ← Volver
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-white">Registrar obrero (expediente)</h1>
        <p className="mt-1 text-sm text-zinc-500">Estado inicial: PENDIENTE_DOCUMENTOS (base de datos).</p>

        <form action={crearContratoExpedienteObraDigital} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Nombre completo</label>
            <input
              name="worker_name"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Cédula (única en el módulo)</label>
            <input name="worker_ci" required className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Oficio</label>
            <input name="oficio" required placeholder="Ej. Electricista" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Salario básico diario (VES)</label>
            <input name="salary_per_day" required type="text" placeholder="120,00" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Meta / partida (LULO)</label>
            <textarea
              name="lulo_partida_meta"
              required
              rows={3}
              placeholder="Ej. 150m tubería EMT 1/2"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
            Crear expediente
          </button>
        </form>
      </div>
    </div>
  );
}
