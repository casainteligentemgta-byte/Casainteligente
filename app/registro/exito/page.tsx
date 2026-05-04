import Link from 'next/link';

function param(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

export default function RegistroExitoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const empleadoId = param(searchParams.empleadoId);
  const cedula = param(searchParams.cedula);
  const pdfHref =
    empleadoId && cedula
      ? `/api/registro/planilla-empleo-pdf?empleadoId=${encodeURIComponent(empleadoId)}&cedula=${encodeURIComponent(cedula)}`
      : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-4 py-16 text-center">
      <div className="max-w-md rounded-2xl border border-[#FF9500]/30 bg-gradient-to-b from-[#FF9500]/10 to-transparent p-8 shadow-xl shadow-black/50">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FFD60A]/90">Casa Inteligente</p>
        <h1 className="mt-3 text-2xl font-bold text-white">¡Registro exitoso!</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Tu perfil está siendo evaluado por Casa Inteligente. Si tu postulación continúa en el proceso, el equipo de talento
          se pondrá en contacto contigo.
        </p>
        {pdfHref ? (
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-[#FF9500]/40 bg-[#FF9500]/15 px-4 py-3 text-sm font-bold text-[#FFD60A] transition hover:bg-[#FF9500]/25"
          >
            Imprimir Planilla para Firma Física
          </a>
        ) : null}
        <Link
          href="/"
          className={`mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-6 py-3 text-sm font-bold text-black transition hover:opacity-95 ${pdfHref ? '' : 'mt-8'}`}
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
