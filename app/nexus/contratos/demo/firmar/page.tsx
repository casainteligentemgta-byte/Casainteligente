import { ContractSignClient } from './ContractSignClient';

export default function NexusContratoFirmarDemoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cierre · Firma digital</h1>
        <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
          Demo del flujo: presupuesto aprobado → contrato → captura de rúbrica → estado{' '}
          <span className="font-mono text-[var(--nexus-green)]">contract_signed</span>.
        </p>
      </div>
      <ContractSignClient />
    </div>
  );
}
