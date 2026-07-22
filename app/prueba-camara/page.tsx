import dynamic from 'next/dynamic';
import Link from 'next/link';

const EspectroCamaraPanel = dynamic(() => import('@/components/proyectos/EspectroCamaraPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-lg border border-white/10 bg-[#111118] text-xs text-zinc-500">
      Cargando espectro de cámara…
    </div>
  ),
});

export default function PruebaCamaraPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Prueba · Planos</p>
            <h1 className="text-xl font-semibold text-white">NetVision PRO</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Coloca cámaras en el plano: icono a escala, espectro de visión con grados (90° / 103° / libre).
            </p>
          </div>
          <Link href="/proyectos" className="text-xs text-[#007AFF] hover:underline">
            Volver a proyectos
          </Link>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0A0A0F] p-4 sm:p-5">
          <EspectroCamaraPanel canvasHeight={560} />
        </div>
      </div>
    </div>
  );
}
