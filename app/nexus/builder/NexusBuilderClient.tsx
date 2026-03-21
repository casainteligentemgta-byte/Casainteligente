'use client';

import { GlassCard } from '@/components/nexus/GlassCard';
import { Button } from '@/components/nexus/ui/button';
import { Mono } from '@/components/nexus/Mono';
import {
  grandTotal,
  lineSubtotal,
  marginPercent,
  sumLines,
  taxFromSubtotal,
  validateMinMargin,
} from '@/lib/nexus/proposal-math';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type CatalogEntry = {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  kind: 'hardware' | 'service';
  costPrice?: number;
};

const MOCK_CATALOG: CatalogEntry[] = [
  { id: 'c1', sku: 'CAM-4K-DOME', name: 'Cámara IP 4K domo', unitPrice: 120, kind: 'hardware', costPrice: 72 },
  { id: 'c2', sku: 'NVR-16', name: 'NVR 16 canales', unitPrice: 480, kind: 'hardware', costPrice: 310 },
  { id: 'c3', sku: 'SRV-INST', name: 'Instalación certificada', unitPrice: 650, kind: 'service', costPrice: 380 },
  { id: 'c4', sku: 'CLD-1Y', name: 'Suscripción cloud 1 año', unitPrice: 199, kind: 'service', costPrice: 40 },
];

type CanvasLine = CatalogEntry & { qty: number; discountPct: number; key: string };

function DraggableItem({ item }: { item: CatalogEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, data: item });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] p-3 active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <GripVertical className="h-4 w-4 text-[var(--nexus-text-dim)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.name}</p>
        <p className="font-mono text-xs text-[var(--nexus-cyan)]">{item.sku}</p>
      </div>
      <Mono className="text-[var(--nexus-green)]">${item.unitPrice}</Mono>
    </div>
  );
}

function CanvasDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[320px] rounded-2xl border-2 border-dashed p-4 transition-colors lg:min-h-[420px] ${
        isOver ? 'border-[var(--nexus-cyan)] bg-[rgba(0,242,254,0.06)]' : 'border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.2)]'
      }`}
    >
      {children}
    </div>
  );
}

export function NexusBuilderClient() {
  const [lines, setLines] = useState<CanvasLine[]>([]);
  const [active, setActive] = useState<CatalogEntry | null>(null);
  const [taxRate, setTaxRate] = useState(16);
  const [discountTotal, setDiscountTotal] = useState(0);
  const marginMin = 18;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const totals = useMemo(() => {
    const inputs = lines.map((l) => ({
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      costPrice: l.costPrice,
    }));
    const subtotal = sumLines(inputs);
    const taxAmount = taxFromSubtotal(subtotal, taxRate);
    const grand = grandTotal(subtotal, taxAmount, discountTotal);
    const lineTotals = lines.map((l) => ({
      lineTotal: lineSubtotal({ qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct }),
      costPrice: l.costPrice,
      qty: l.qty,
    }));
    const m = marginPercent(lineTotals);
    const marginCheck = validateMinMargin(m, marginMin);
    return { subtotal, taxAmount, grand, marginPct: m, marginCheck };
  }, [lines, taxRate, discountTotal, marginMin]);

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const item = MOCK_CATALOG.find((c) => c.id === id);
    setActive(item ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const id = String(e.active.id);
    if (e.over?.id !== 'canvas') return;
    const item = MOCK_CATALOG.find((c) => c.id === id);
    if (!item) return;
    setLines((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { ...item, qty: 1, discountPct: 0, key: `${item.id}-${Date.now()}` }];
    });
  }

  function updateLine(key: string, patch: Partial<CanvasLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <GlassCard>
          <h2 className="text-sm font-semibold text-white">Catálogo</h2>
          <p className="mt-1 text-xs text-[var(--nexus-text-dim)]">Arrastra al lienzo →</p>
          <div className="mt-4 space-y-2">
            {MOCK_CATALOG.map((item) => (
              <DraggableItem key={item.id} item={item} />
            ))}
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard glow>
            <h2 className="text-sm font-semibold text-[var(--nexus-cyan)]">Lienzo de proyecto</h2>
            <CanvasDrop>
              {lines.length === 0 ? (
                <p className="py-20 text-center text-sm text-[var(--nexus-text-dim)]">
                  Suelta aquí productos y servicios del catálogo
                </p>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence>
                    {lines.map((l) => (
                      <motion.li
                        key={l.key}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">{l.name}</p>
                          <p className="font-mono text-xs text-[var(--nexus-cyan)]">{l.sku}</p>
                        </div>
                        <label className="flex items-center gap-1 text-xs text-[var(--nexus-text-muted)]">
                          Qty
                          <input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) => updateLine(l.key, { qty: Math.max(1, Number(e.target.value)) })}
                            className="w-16 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.3)] px-2 py-1 font-mono text-sm text-white"
                          />
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[var(--nexus-text-muted)]">
                          Desc %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={l.discountPct}
                            onChange={(e) => updateLine(l.key, { discountPct: Number(e.target.value) })}
                            className="w-16 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.3)] px-2 py-1 font-mono text-sm text-white"
                          />
                        </label>
                        <Mono className="text-[var(--nexus-green)]">
                          $
                          {lineSubtotal({
                            qty: l.qty,
                            unitPrice: l.unitPrice,
                            discountPct: l.discountPct,
                          }).toFixed(2)}
                        </Mono>
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="rounded-lg p-2 text-[var(--nexus-text-dim)] hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CanvasDrop>
          </GlassCard>

          <GlassCard>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-[var(--nexus-text-muted)]">
                IVA / impuesto %
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.35)] px-3 py-2 font-mono text-white"
                />
              </label>
              <label className="text-sm text-[var(--nexus-text-muted)]">
                Descuento global ($)
                <input
                  type="number"
                  value={discountTotal}
                  onChange={(e) => setDiscountTotal(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.35)] px-3 py-2 font-mono text-white"
                />
              </label>
            </div>
            <div className="mt-4 space-y-2 border-t border-[rgba(255,255,255,0.08)] pt-4 font-mono text-sm">
              <div className="flex justify-between text-[var(--nexus-text-muted)]">
                <span>Subtotal</span>
                <Mono className="text-white">${totals.subtotal.toFixed(2)}</Mono>
              </div>
              <div className="flex justify-between text-[var(--nexus-text-muted)]">
                <span>Impuesto</span>
                <Mono className="text-[var(--nexus-cyan)]">${totals.taxAmount.toFixed(2)}</Mono>
              </div>
              <div className="flex justify-between text-lg font-semibold text-white">
                <span>Total</span>
                <Mono className="text-[var(--nexus-green)]">${totals.grand.toFixed(2)}</Mono>
              </div>
              {totals.marginPct != null ? (
                <div className="flex justify-between text-xs text-[var(--nexus-text-dim)]">
                  <span>Margen estimado</span>
                  <Mono className={totals.marginCheck.ok ? 'text-[var(--nexus-green)]' : 'text-[var(--nexus-gold)]'}>
                    {totals.marginPct.toFixed(1)}% {totals.marginCheck.ok ? '' : `· ${totals.marginCheck.message}`}
                  </Mono>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" variant="glass" disabled>
                Guardar propuesta (DB)
              </Button>
              <Button asChild>
                <a href="/api/nexus/proposals/demo/pdf" target="_blank" rel="noopener noreferrer">
                  Generar propuesta PDF
                </a>
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--nexus-text-dim)]">
              El PDF de demo es HTML premium oscuro; conecta propuestas reales en una siguiente fase.
            </p>
          </GlassCard>
        </div>
      </div>
      <DragOverlay>
        {active ? (
          <div className="rounded-xl border border-[var(--nexus-cyan)] bg-[rgba(10,11,16,0.95)] p-3 shadow-[0_0_30px_var(--color-primary-glow)]">
            <p className="text-sm font-medium text-white">{active.name}</p>
            <p className="font-mono text-xs text-[var(--nexus-cyan)]">{active.sku}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
