import { GlassCardMotion } from '@/components/nexus/GlassCard';
import { Button } from '@/components/nexus/ui/button';
import { Mono } from '@/components/nexus/Mono';
import { Camera, Layers, Scan } from 'lucide-react';

export default function NexusVisionPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Architect & Vision</h1>
        <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
          Concepto: heatmap de seguridad sobre planos y AR para técnicos en campo (tablet).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCardMotion>
          <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 stroke-[2] text-[var(--nexus-cyan)] drop-shadow-[0_0_12px_var(--color-primary-glow)]" />
            <div>
              <h2 className="text-lg font-semibold text-white">AI Architect</h2>
              <p className="text-sm text-[var(--nexus-text-muted)]">Sube planos o fotos del inmueble</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--nexus-text-dim)]">
            Pipeline futuro: visión por computador + capa de <Mono className="text-[var(--nexus-cyan)]">heatmap neón</Mono>{' '}
            con puntos recomendados para cámaras, sensores y hubs según flujos y puntos ciegos.
          </p>
          <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-[rgba(0,242,254,0.25)] bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.15),transparent_70%)]">
            <p className="text-center text-xs text-[var(--nexus-text-dim)]">Zona de preview heatmap (mock)</p>
          </div>
          <Button variant="glass" className="mt-4 w-full" type="button" disabled>
            Procesar plano (próximamente)
          </Button>
        </GlassCardMotion>

        <GlassCardMotion delay={0.08}>
          <div className="flex items-center gap-3">
            <Camera className="h-8 w-8 stroke-[2] text-[var(--nexus-green)] drop-shadow-[0_0_12px_rgba(0,255,65,0.4)]" />
            <div>
              <h2 className="text-lg font-semibold text-white">Vision AR · Campo</h2>
              <p className="text-sm text-[var(--nexus-text-muted)]">Cámara tablet · tuberías virtuales</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--nexus-text-dim)]">
            Superposición de <Mono className="text-[var(--nexus-green)]">cables / canalizaciones</Mono> en paredes reales
            (estilo rayos X). Requiere WebXR / ARKit / ARCore según dispositivo.
          </p>
          <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-[rgba(0,255,65,0.2)] bg-[linear-gradient(135deg,rgba(0,255,65,0.06),transparent)]">
            <Scan className="h-12 w-12 text-[var(--nexus-text-dim)]" strokeWidth={1.5} />
          </div>
          <Button variant="success" className="mt-4 w-full" type="button" disabled>
            Iniciar sesión AR (próximamente)
          </Button>
        </GlassCardMotion>
      </div>
    </div>
  );
}
