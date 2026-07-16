import Link from 'next/link';
import { Mono } from '@/components/nexus/Mono';
import { NexusAlert } from '@/components/nexus/NexusAlert';

/** Aviso: CRM construcción ≠ nexus_clients; puente futuro documentado en NEXUS-HOME.md */
export function NexusCrmOperativoAviso() {
  return (
    <NexusAlert variant="info" title="CRM operativo de construcción">
      <p>
        Obras, compras y Telegram usan{' '}
        <Link href="/clientes" className="font-medium text-[var(--nexus-cyan)] underline underline-offset-2">
          /clientes
        </Link>{' '}
        (<Mono>customers</Mono>). Aquí se listan registros de domótica en <Mono>nexus_clients</Mono> — datos
        separados.
      </p>
      <p className="mt-2 text-xs text-[var(--nexus-text-dim)]">
        Puente futuro <Mono>nexus_clients</Mono> → <Mono>customers</Mono> planificado (opción C); sin sync automático
        aún. Detalle: <Mono>docs/NEXUS-HOME.md</Mono>.
      </p>
    </NexusAlert>
  );
}
