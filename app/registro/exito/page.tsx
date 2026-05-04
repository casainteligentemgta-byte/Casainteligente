export default function RegistroExitoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-4 py-16 text-center">
      <div className="max-w-md rounded-2xl border border-[#FF9500]/30 bg-gradient-to-b from-[#FF9500]/10 to-transparent p-8 shadow-xl shadow-black/50">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FFD60A]/90">Casa Inteligente</p>
        <h1 className="mt-3 text-2xl font-bold text-white">¡Registro exitoso!</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Tu perfil está siendo evaluado por Casa Inteligente. Si tu postulación continúa en el proceso, el equipo de talento
          se pondrá en contacto contigo.
        </p>
        <p className="mt-6 text-xs text-zinc-500">Ya puedes cerrar esta ventana.</p>
      </div>
    </div>
  );
}
