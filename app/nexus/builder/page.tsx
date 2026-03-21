import { NexusBuilderClient } from './NexusBuilderClient';

export default function NexusBuilderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nexus Builder</h1>
        <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
          Arrastra ítems del catálogo al lienzo. Totales, impuestos y validación de margen mínimo en vivo.
        </p>
      </div>
      <NexusBuilderClient />
    </div>
  );
}
