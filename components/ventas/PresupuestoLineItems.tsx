'use client';

import { useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react';
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
    type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Product } from '@/components/ventas/ProductSearch';

export interface LineItem {
    id: string;
    product: Product;
    qty: number;
    unitPrice: number;
    discount: number;
    inventoryItemIds?: (string | null)[];
    serialNumbers?: (string | null)[];
}

export function formatUSD(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Input numérico que permite borrar todo el valor mientras se edita.
 * Solo confirma el número al escribir un valor válido o al salir del campo
 * (evita el “siempre hay un 0/1” que produce montos como 0120 en móvil).
 */
export function EditableNumberInput({
    value,
    onCommit,
    emptyFallback,
    min,
    max,
    step,
    integer = false,
    inputMode = 'decimal',
    style,
    'aria-label': ariaLabel,
}: {
    value: number;
    onCommit: (n: number) => void;
    emptyFallback: number;
    min?: number;
    max?: number;
    step?: number | string;
    integer?: boolean;
    inputMode?: 'decimal' | 'numeric';
    style?: CSSProperties;
    'aria-label'?: string;
}) {
    const [draft, setDraft] = useState<string | null>(null);

    const clamp = (n: number) => {
        let next = n;
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        return next;
    };

    const parseRaw = (raw: string): number | null => {
        if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return null;
        const n = integer ? parseInt(raw, 10) : parseFloat(raw);
        return Number.isFinite(n) ? n : null;
    };

    const display = draft !== null ? draft : String(value);

    return (
        <input
            type="text"
            inputMode={inputMode}
            step={step}
            aria-label={ariaLabel}
            value={display}
            onFocus={(e) => {
                setDraft(String(value));
                e.target.select();
            }}
            onChange={(e) => {
                let raw = e.target.value.replace(',', '.');
                if (raw !== '' && !/^-?\d*\.?\d*$/.test(raw)) return;
                // Evitar ceros a la izquierda tipo "0120" al teclear tras un 0 forzado.
                if (!integer && /^0\d/.test(raw)) raw = raw.replace(/^0+/, '');
                if (integer && /^0\d+/.test(raw)) raw = raw.replace(/^0+/, '') || '0';
                setDraft(raw);
                if (raw.endsWith('.')) return;
                const n = parseRaw(raw);
                if (n === null) return;
                onCommit(clamp(n));
            }}
            onBlur={() => {
                const raw = draft;
                setDraft(null);
                const n = raw === null ? value : parseRaw(raw);
                onCommit(clamp(n === null ? emptyFallback : n));
            }}
            style={style}
        />
    );
}

function CategoryBadge({ cat }: { cat: string | null }) {
    const colorMap: Record<string, { bg: string; text: string }> = {
        'Cámaras IP': { bg: 'rgba(0,122,255,0.15)', text: '#007AFF' },
        'Cámaras Análogas': { bg: 'rgba(88,86,214,0.15)', text: '#5856D6' },
        'C.C.T.V': { bg: 'rgba(88,86,214,0.15)', text: '#5856D6' },
        'Servicio': { bg: 'rgba(52,199,89,0.15)', text: '#34C759' },
        'Cercos Eléctricos': { bg: 'rgba(255,149,0,0.15)', text: '#FF9500' },
        'Internet': { bg: 'rgba(0,199,190,0.15)', text: '#00C7BE' },
        'Domótica': { bg: 'rgba(255,45,85,0.15)', text: '#FF2D55' },
        'Network': { bg: 'rgba(0,199,190,0.15)', text: '#00C7BE' },
        'Materiales': { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93' },
    };
    const c = colorMap[cat ?? ''] ?? { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93' };
    return (
        <span style={{
            background: c.bg, color: c.text,
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '6px', letterSpacing: '0.3px', whiteSpace: 'nowrap',
        }}>
            {cat ?? 'General'}
        </span>
    );
}

function LineItemProductThumb({ imagen }: { imagen?: string | null }) {
    const [failed, setFailed] = useState(false);
    const url = typeof imagen === 'string' ? imagen.trim() : '';
    if (!url || failed) return null;
    return (
        <img
            src={url}
            alt=""
            width={44}
            height={44}
            onError={() => setFailed(true)}
            style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                objectFit: 'cover',
                flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.35)',
            }}
        />
    );
}

const glassCard: CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
};

function lineTotal(item: LineItem) {
    return item.unitPrice * (1 - item.discount / 100) * item.qty;
}

function lineCost(item: LineItem) {
    return (item.product.costo ?? 0) * item.qty;
}

type LineItemCardProps = {
    item: LineItem;
    idx: number;
    isOverlay?: boolean;
    isDragging?: boolean;
    dragStyle?: CSSProperties;
    setNodeRef?: (node: HTMLElement | null) => void;
    attributes?: HTMLAttributes<HTMLElement>;
    listeners?: DraggableSyntheticListeners;
    onRemove: (id: string) => void;
    onUpdateQty: (id: string, qty: number) => void;
    onUpdatePrice: (id: string, price: number) => void;
    onUpdateDiscount: (id: string, disc: number) => void;
    onOpenSerials: (item: LineItem) => void;
};

function LineItemCard({
    item,
    idx,
    isOverlay = false,
    isDragging = false,
    dragStyle,
    setNodeRef,
    attributes,
    listeners,
    onRemove,
    onUpdateQty,
    onUpdatePrice,
    onUpdateDiscount,
    onOpenSerials,
}: LineItemCardProps) {
    const total = lineTotal(item);
    const cost = lineCost(item);
    const profit = total - cost;
    const profitPct = total > 0 ? (profit / total) * 100 : 0;

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onContextMenu={isOverlay ? undefined : (e) => {
                const el = e.target as HTMLElement | null;
                if (el?.closest('input, textarea, button, a, select')) return;
                e.preventDefault();
            }}
            style={{
                ...glassCard,
                padding: '16px',
                animation: isOverlay || isDragging ? 'none' : 'slideUp 0.3s ease',
                opacity: isDragging ? 0 : 1,
                cursor: isOverlay ? 'grabbing' : 'grab',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: isOverlay ? 'none' : undefined,
                boxShadow: isOverlay
                    ? '0 28px 64px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.16)'
                    : undefined,
                transform: isOverlay ? 'scale(1.03) rotate(1.4deg)' : dragStyle?.transform,
                transition: isOverlay ? undefined : dragStyle?.transition,
                zIndex: isDragging ? 1 : dragStyle?.zIndex,
                position: 'relative',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ opacity: 0.45 }}>
                        <circle cx="3" cy="3" r="1.15" fill="rgba(255,255,255,0.85)" />
                        <circle cx="9" cy="3" r="1.15" fill="rgba(255,255,255,0.85)" />
                        <circle cx="3" cy="6" r="1.15" fill="rgba(255,255,255,0.85)" />
                        <circle cx="9" cy="6" r="1.15" fill="rgba(255,255,255,0.85)" />
                        <circle cx="3" cy="9" r="1.15" fill="rgba(255,255,255,0.85)" />
                        <circle cx="9" cy="9" r="1.15" fill="rgba(255,255,255,0.85)" />
                    </svg>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'rgba(0,122,255,0.15)', border: '1px solid rgba(0,122,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700, color: '#007AFF',
                    }}>
                        {idx + 1}
                    </div>
                </div>
                <LineItemProductThumb imagen={item.product.imagen} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <CategoryBadge cat={item.product.categoria} />
                        {item.product.marca && (
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{item.product.marca}</span>
                        )}
                    </div>
                    <p style={{ color: 'var(--label-primary)', fontSize: '14px', fontWeight: 600, lineHeight: 1.3 }}>
                        {item.product.nombre}
                    </p>
                    {item.product.modelo && (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '2px' }}>
                            Modelo: {item.product.modelo}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    tabIndex={isOverlay ? -1 : 0}
                    style={{
                        background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)',
                        borderRadius: '8px', width: '30px', height: '30px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0,
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty - 1)} style={{ width: '34px', height: '34px', background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <EditableNumberInput
                        value={item.qty}
                        emptyFallback={1}
                        min={1}
                        integer
                        inputMode="numeric"
                        onCommit={(n) => onUpdateQty(item.id, n)}
                        aria-label="Cantidad"
                        style={{ width: '40px', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', color: 'white', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit' }}
                    />
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty + 1)} style={{ width: '34px', height: '34px', background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', padding: '0 10px', height: '34px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>$</span>
                    <EditableNumberInput
                        value={item.unitPrice}
                        emptyFallback={0}
                        min={0}
                        step={0.01}
                        inputMode="decimal"
                        onCommit={(n) => onUpdatePrice(item.id, n)}
                        aria-label="Precio unitario"
                        style={{ width: '70px', background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,149,0,0.08)', borderRadius: '10px', border: '1px solid rgba(255,149,0,0.2)', padding: '0 10px', height: '34px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M19 5L5 19M9 7a2 2 0 11-4 0 2 2 0 014 0zm10 10a2 2 0 11-4 0 2 2 0 014 0z" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <EditableNumberInput
                        value={item.discount}
                        emptyFallback={0}
                        min={0}
                        max={100}
                        inputMode="decimal"
                        onCommit={(n) => onUpdateDiscount(item.id, n)}
                        aria-label="Descuento"
                        style={{ width: '36px', background: 'transparent', border: 'none', outline: 'none', color: '#FF9500', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }}
                    />
                    <span style={{ color: '#FF9500', fontSize: '13px' }}>%</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => onOpenSerials(item)}
                        tabIndex={isOverlay ? -1 : 0}
                        style={{
                            background: 'rgba(142,142,147,0.12)',
                            border: '1px solid rgba(142,142,147,0.25)',
                            color: 'rgba(255,255,255,0.85)',
                            borderRadius: '10px',
                            height: '34px',
                            padding: '0 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Seriales
                    </button>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        {(item.inventoryItemIds ?? []).filter((x): x is string => Boolean(x)).length}/{item.qty}
                    </span>
                </div>

                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ color: '#34C759', fontSize: '16px', fontWeight: 700 }}>${formatUSD(total)}</div>
                    <div style={{ fontSize: '11px', color: profitPct >= 20 ? 'rgba(52,199,89,0.7)' : 'rgba(255,149,0,0.7)' }}>
                        Margen {profitPct.toFixed(0)}% · +${formatUSD(profit)}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SortableLineItem(props: Omit<LineItemCardProps, 'isOverlay' | 'isDragging' | 'dragStyle' | 'setNodeRef' | 'attributes' | 'listeners'> & { disabled?: boolean }) {
    const { disabled, ...cardProps } = props;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: props.item.id,
        disabled: Boolean(disabled),
    });

    return (
        <LineItemCard
            {...cardProps}
            isDragging={isDragging}
            setNodeRef={setNodeRef}
            attributes={attributes}
            listeners={disabled ? undefined : listeners}
            dragStyle={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
        />
    );
}

export type PresupuestoLineItemsProps = {
    items: LineItem[];
    onReorder: (next: LineItem[]) => void;
    onRemove: (id: string) => void;
    onUpdateQty: (id: string, qty: number) => void;
    onUpdatePrice: (id: string, price: number) => void;
    onUpdateDiscount: (id: string, disc: number) => void;
    onOpenSerials: (item: LineItem) => void;
};

export default function PresupuestoLineItems({
    items,
    onReorder,
    onRemove,
    onUpdateQty,
    onUpdatePrice,
    onUpdateDiscount,
    onOpenSerials,
}: PresupuestoLineItemsProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const sortableEnabled = items.length > 1;

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const itemIds = useMemo(() => items.map((i) => i.id), [items]);
    const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;
    const activeIdx = activeItem ? items.findIndex((i) => i.id === activeItem.id) : -1;

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id));
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(12);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onReorder(arrayMove(items, oldIndex, newIndex));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
        >
            {sortableEnabled ? (
                <p style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.42)',
                    margin: '0 2px 8px',
                    lineHeight: 1.4,
                }}>
                    Mantén presionado un producto para moverlo y cambiar el orden
                </p>
            ) : null}

            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}
                    aria-label="Productos del presupuesto"
                >
                    {items.map((item, idx) => (
                        <SortableLineItem
                            key={item.id}
                            item={item}
                            idx={idx}
                            disabled={!sortableEnabled}
                            onRemove={onRemove}
                            onUpdateQty={onUpdateQty}
                            onUpdatePrice={onUpdatePrice}
                            onUpdateDiscount={onUpdateDiscount}
                            onOpenSerials={onOpenSerials}
                        />
                    ))}
                </div>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeItem ? (
                    <div style={{ pointerEvents: 'none' }}>
                        <LineItemCard
                            item={activeItem}
                            idx={activeIdx >= 0 ? activeIdx : 0}
                            isOverlay
                            onRemove={onRemove}
                            onUpdateQty={onUpdateQty}
                            onUpdatePrice={onUpdatePrice}
                            onUpdateDiscount={onUpdateDiscount}
                            onOpenSerials={onOpenSerials}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
