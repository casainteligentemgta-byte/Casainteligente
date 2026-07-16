'use client';

import { GlassCard } from '@/components/nexus/GlassCard';
import { Button } from '@/components/nexus/ui/button';
import { Mono } from '@/components/nexus/Mono';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Eraser } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

/** Isotipo estilo laberinto / huella — se fusiona con la firma al validar */
function NexusIsotype({ phase }: { phase: 'idle' | 'merging' | 'done' }) {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden>
      <motion.path
        d="M12 8h16v12H12V8zm24 0h16v28H36V8zM12 28h20v28H12V28zm28 12h16v16H40V40z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-[var(--nexus-cyan)]"
        initial={false}
        animate={
          phase === 'idle'
            ? { pathLength: 1, opacity: 0.6 }
            : phase === 'merging'
              ? { pathLength: 1, opacity: 1 }
              : { pathLength: 1, opacity: 1, stroke: '#00ff41' }
        }
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={
          phase === 'merging'
            ? { filter: 'drop-shadow(0 0 10px rgba(0,242,254,0.85))' }
            : undefined
        }
      />
      <motion.circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-[rgba(0,242,254,0.25)]"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={
          phase === 'done'
            ? { scale: 1.15, opacity: 0 }
            : phase === 'merging'
              ? { scale: 1.05, opacity: 0.6 }
              : { scale: 1, opacity: 0.3 }
        }
        transition={{ duration: 1 }}
      />
    </svg>
  );
}

export function ContractSignClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [phase, setPhase] = useState<'idle' | 'merging' | 'done'>('idle');
  const [saleState, setSaleState] = useState<'proposal_sent' | 'contract_signed'>('proposal_sent');

  const getCtx = () => canvasRef.current?.getContext('2d');

  const start = useCallback((x: number, y: number) => {
    drawing.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,242,254,0.8)';
    ctx.shadowBlur = 6;
  }, []);

  const move = useCallback((x: number, y: number) => {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }, []);

  const end = useCallback(() => {
    drawing.current = false;
  }, []);

  const clear = () => {
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const finalize = () => {
    if (!signerName.trim() || !hasInk) return;
    setPhase('merging');
    setTimeout(() => {
      setPhase('done');
      setSaleState('contract_signed');
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <GlassCard glow>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--nexus-cyan)]">Contrato digital</p>
        <h1 className="mt-2 text-xl font-bold text-white">Firma de aceptación</h1>
        <p className="mt-2 text-sm text-[var(--nexus-text-muted)]">
          Al aprobar el presupuesto, se genera el contrato legal. Estado de venta:{' '}
          <Mono className={saleState === 'contract_signed' ? 'text-[var(--nexus-green)]' : 'text-[var(--nexus-gold)]'}>
            {saleState === 'proposal_sent' ? 'proposal_sent' : 'contract_signed'}
          </Mono>
        </p>
      </GlassCard>

      <GlassCard>
        <label className="block text-sm text-[var(--nexus-text-muted)]">
          Nombre completo del firmante
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.35)] px-3 py-2 text-white"
            placeholder="Como en documento"
          />
        </label>
        <p className="mt-4 text-xs text-[var(--nexus-text-dim)]">Rúbrica (dibujar con el dedo o ratón)</p>
        <div className="relative mt-2 overflow-hidden rounded-xl border border-[rgba(0,242,254,0.25)] bg-[#05060a]">
          <canvas
            ref={canvasRef}
            width={440}
            height={200}
            className="touch-none w-full max-w-full"
            onMouseDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              start(e.clientX - r.left, e.clientY - r.top);
            }}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              move(e.clientX - r.left, e.clientY - r.top);
            }}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={(e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const t = e.touches[0];
              start(t.clientX - r.left, t.clientY - r.top);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const t = e.touches[0];
              move(t.clientX - r.left, t.clientY - r.top);
            }}
            onTouchEnd={end}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="glass" onClick={clear}>
            <Eraser className="h-4 w-4" /> Limpiar
          </Button>
          <Button type="button" onClick={finalize} disabled={!hasInk || !signerName.trim() || phase !== 'idle'}>
            Firmar y validar
          </Button>
        </div>
      </GlassCard>

      <AnimatePresence>
        {phase !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-[rgba(0,242,254,0.3)] bg-[rgba(10,11,16,0.9)] p-8 backdrop-blur-[20px]"
          >
            <motion.div
              animate={phase === 'merging' ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : {}}
              transition={{ duration: 1.2 }}
              className="relative flex items-center justify-center"
            >
              <NexusIsotype phase={phase} />
              {phase === 'merging' && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-[var(--nexus-cyan)] opacity-20 blur-2xl"
                  animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </motion.div>
            {phase === 'done' && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 text-[var(--nexus-green)]"
              >
                <Check className="h-5 w-5 stroke-[2]" /> Acuerdo validado · Contrato firmado
              </motion.p>
            )}
            {phase === 'merging' && (
              <p className="mt-4 text-sm text-[var(--nexus-cyan)]">Fusionando huella digital con firma…</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
