export const metadata = {
  title: 'Contrato de trabajo',
};

/**
 * Antes: aceptación del contrato por enlace. Se retiró: el contrato se imprime,
 * se firma en físico y la empresa archiva el ejemplar firmado.
 */
export default function ContratoLaboralEnlaceRetiradoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-6 py-16 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <h1 className="text-xl font-bold">Contrato de trabajo</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          Este enlace ya no está disponible. El contrato se firma en físico: la empresa te entrega dos
          ejemplares impresos para firmar y colocar tu huella, y uno queda para ti.
        </p>
        <p className="mt-3 text-sm text-zinc-400">Si tienes dudas, comunícate con la persona que te contrató.</p>
      </div>
    </main>
  );
}
