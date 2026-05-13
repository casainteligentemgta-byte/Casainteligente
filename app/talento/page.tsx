import Link from 'next/link';
import { hrefListaContratosExpress } from '@/lib/talento/hrefListaContratosExpress';

const EXPRESS_LIST_HREF = hrefListaContratosExpress();
const EXPRESS_LIST_ES_EXTERNO =
  EXPRESS_LIST_HREF.startsWith('http://') || EXPRESS_LIST_HREF.startsWith('https://');

const cards = [
  {
    href: '/talento/examen',
    title: 'Evaluación adaptativa',
    desc: '25 ítems · 20 personalidad + 5 lógica por rol · 15 min',
    accent: 'from-sky-500/20 to-cyan-500/5 border-sky-500/30',
  },
  {
    href: EXPRESS_LIST_HREF,
    title: 'Contratos express (lista)',
    desc: EXPRESS_LIST_ES_EXTERNO
      ? 'Se abre el listado en el deployment configurado (Vercel / legacy fast-list).'
      : 'Sin registro en Talento: ver filas, abrir PDF, ir al módulo del proyecto o borrar.',
    accent: 'from-amber-500/25 to-zinc-900/50 border-amber-500/45',
  },  {
    href: '/talento/admin/contratos',
    title: 'Contratos dinámicos',
    desc: 'Empleado aprobado + obra · monto y % inicial · modelo CENTAURO LAW',
    accent: 'from-violet-500/20 to-fuchsia-500/5 border-violet-500/30',
  },
  {
    href: '/talento/obras/seguimiento',
    title: 'Seguimiento de obra',
    desc: 'Avance vs fecha prometida · penalización por retraso',
    accent: 'from-amber-500/20 to-orange-500/5 border-amber-500/30',
  },
  {
    href: '/talento/obras/cierre',
    title: 'Cierre y rentabilidad',
    desc: 'Materiales + pago neto al talento · margen del proyecto',
    accent: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/30',
  },
];

export default function TalentoHomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 pb-28">
      <header className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500 mb-2">Casa Inteligente</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">Talento & Obras</h1>
        <p className="text-zinc-400 text-sm md:text-base max-w-2xl leading-relaxed">
          Módulo operativo para reclutamiento con examen cronometrado, semáforo de contratación, contratos legales
          parametrizables y control económico de obra.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/talento/admin/contratos/fast-create"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/20 transition-colors"
          >
            Generar Contrato Express (Sin Registro)
          </Link>
          <Link
            href={EXPRESS_LIST_HREF}
            {...(EXPRESS_LIST_ES_EXTERNO ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-500/60 bg-amber-950/40 px-4 py-2.5 text-sm font-semibold text-amber-50 shadow-sm shadow-amber-900/20 hover:bg-amber-900/50 transition-colors"
          >
            Lista de contratos express
          </Link>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => {
          const ext = c.href.startsWith('http://') || c.href.startsWith('https://');
          return (
          <Link
            key={c.href}
            href={c.href}
            {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={`group rounded-2xl border bg-gradient-to-br p-6 transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-black/40 ${c.accent}`}
          >
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-sky-100">{c.title}</h2>
            <p className="text-sm text-zinc-400 leading-snug">{c.desc}</p>
            <span className="mt-4 inline-flex items-center text-xs font-medium text-zinc-500 group-hover:text-zinc-300">
              Abrir →
            </span>
          </Link>
          );
        })}      </div>

      <p className="mt-10 text-xs text-zinc-600">
        Requiere migración SQL <code className="text-zinc-400">025_ci_talento_obras.sql</code> en Supabase.
      </p>
    </div>
  );
}
