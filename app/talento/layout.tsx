export default function TalentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="talento-module min-h-screen bg-[var(--bg-primary)] text-[var(--label-primary)]">{children}</div>
  );
}
