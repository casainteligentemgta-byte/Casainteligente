import Link from 'next/link';

export default function RrhhLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="no-print sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0f]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-2">
          <Link
            href="/talento"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 shadow-sm shadow-sky-950/30 transition hover:bg-sky-500/25 sm:text-sm"
          >
            <span>Icon</span>
            Talento & Obras
          </Link>
        </div>
      </div>
      {children}
    </>
  );
}
