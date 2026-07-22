'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Wedge, Circle, Image as KonvaImage, Text, Line, Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import {
  type CamaraPlano,
  type EscalaPlano,
  type Punto2D,
  escalaIconoCamara,
  formatDistancia,
  puntoAsaRotacion,
  wedgeRotation,
} from '@/lib/proyectos/espectroCamara';

export type BackgroundLoadStatus = 'idle' | 'loading' | 'ok' | 'error';

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 10;
const ZOOM_STEP = 1.2;

type ViewTransform = { scale: number; x: number; y: number };

type Props = {
  width: number;
  height: number;
  camaras: CamaraPlano[];
  selectedId: string | null;
  backgroundUrl?: string | null;
  escala?: EscalaPlano | null;
  calibrando?: boolean;
  puntosCalibracion?: Punto2D[];
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CamaraPlano>) => void;
  onBackgroundStatus?: (status: BackgroundLoadStatus) => void;
  onCalibracionClick?: (punto: Punto2D) => void;
  className?: string;
};

function fitContain(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): { x: number; y: number; width: number; height: number } {
  if (imgW <= 0 || imgH <= 0) return { x: 0, y: 0, width: boxW, height: boxH };
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}

function puntoEnContenido(
  stage: Konva.Stage,
  pointer: { x: number; y: number },
): Punto2D {
  const transform = stage.getAbsoluteTransform().copy();
  transform.invert();
  const p = transform.point(pointer);
  return { x: p.x, y: p.y };
}

function zoomHaciaPunto(
  prev: ViewTransform,
  factor: number,
  pivot: Punto2D,
): ViewTransform {
  const oldScale = prev.scale;
  const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldScale * factor));
  if (newScale === oldScale) return prev;
  const world = {
    x: (pivot.x - prev.x) / oldScale,
    y: (pivot.y - prev.y) / oldScale,
  };
  return {
    scale: newScale,
    x: pivot.x - world.x * newScale,
    y: pivot.y - world.y * newScale,
  };
}

function zoomHaciaCentro(
  prev: ViewTransform,
  factor: number,
  width: number,
  height: number,
): ViewTransform {
  return zoomHaciaPunto(prev, factor, { x: width / 2, y: height / 2 });
}

function useHtmlImage(
  url: string | null | undefined,
  onStatus?: (status: BackgroundLoadStatus) => void,
) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    if (!url) {
      setImage(null);
      onStatusRef.current?.('idle');
      return;
    }

    let cancelled = false;
    onStatusRef.current?.('loading');
    const img = new window.Image();

    if (/^https?:\/\//i.test(url)) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      onStatusRef.current?.('ok');
    };
    img.onerror = () => {
      if (cancelled) return;
      setImage(null);
      onStatusRef.current?.('error');
    };
    img.src = url;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return image;
}

function LabelDistancia({
  x,
  y,
  text,
  fill,
  compact,
}: {
  x: number;
  y: number;
  text: string;
  fill: string;
  compact?: boolean;
}) {
  return (
    <Text
      x={x}
      y={y}
      text={text}
      fontSize={compact ? 10 : 11}
      fontStyle="bold"
      fill={fill}
      stroke="#0a0a0f"
      strokeWidth={compact ? 2.5 : 3}
      fillAfterStrokeEnabled
      listening={false}
    />
  );
}

/** Icono discreto en el vértice; se escala con el plano (metros/píxel). */
function IconoCamara({ selected }: { selected: boolean }) {
  const body = selected ? 'rgba(39, 39, 42, 0.92)' : 'rgba(24, 24, 27, 0.78)';
  const accent = selected ? 'rgba(161, 161, 170, 0.95)' : 'rgba(113, 113, 122, 0.85)';
  const lens = selected ? 'rgba(212, 212, 216, 0.55)' : 'rgba(161, 161, 170, 0.4)';
  return (
    <>
      <Rect
        x={-4.2}
        y={-3.2}
        width={7.5}
        height={6.4}
        cornerRadius={0.9}
        fill={body}
        stroke={accent}
        strokeWidth={0.55}
        listening={false}
      />
      <Rect
        x={-1.4}
        y={-4.6}
        width={2.8}
        height={1.3}
        cornerRadius={0.3}
        fill={accent}
        opacity={0.7}
        listening={false}
      />
      <Circle
        x={3.2}
        y={0}
        radius={2.15}
        fill="rgba(9, 9, 11, 0.9)"
        stroke={accent}
        strokeWidth={0.5}
        listening={false}
      />
      <Circle x={3.2} y={0} radius={0.75} fill={lens} listening={false} />
    </>
  );
}

function formatFovLabel(angle: number): string {
  const rounded = Math.round(angle * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}°` : `${rounded.toFixed(1)}°`;
}

function CamaraNode({
  camara,
  selected,
  escala,
  viewScale,
  onSelect,
  onChange,
}: {
  camara: CamaraPlano;
  selected: boolean;
  escala: EscalaPlano | null;
  viewScale: number;
  onSelect: () => void;
  onChange: (patch: Partial<CamaraPlano>) => void;
}) {
  const asa = puntoAsaRotacion(camara);
  const fill = selected ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.1)';
  const stroke = selected ? '#22c55e' : 'rgba(74, 222, 128, 0.4)';
  const distanciaCanvas = Math.hypot(asa.x - camara.x, asa.y - camara.y) || camara.radius;
  const midX = (camara.x + asa.x) / 2;
  const midY = (camara.y + asa.y) / 2;
  const dx = asa.x - camara.x;
  const dy = asa.y - camara.y;
  const len = Math.hypot(dx, dy) || 1;
  /** Texto legible al zoom; el icono sí sigue la escala del plano. */
  const uiScale = 1 / Math.max(viewScale, 0.01);
  const iconScale = escalaIconoCamara(escala);
  const labelOffset = 10 * uiScale;
  const labelX = midX + (-dy / len) * labelOffset;
  const labelY = midY + (dx / len) * labelOffset - 4 * uiScale;
  const fovAlong = Math.max(18, camara.radius * 0.68);
  const fovRad = (camara.rotation * Math.PI) / 180;
  const fovLabelX = camara.x + Math.cos(fovRad) * fovAlong;
  const fovLabelY = camara.y + Math.sin(fovRad) * fovAlong;
  const distLabel = formatDistancia(distanciaCanvas, escala);
  const fovLabel = formatFovLabel(camara.angle);
  const hitR = Math.max(7, 5.5 * iconScale);

  const onDragBody = (e: KonvaEventObject<DragEvent>) => {
    onChange({ x: e.target.x(), y: e.target.y() });
  };

  return (
    <>
      {/* Sin listening: el FOV no bloquea clics en zonas chicas / cámaras solapadas */}
      <Wedge
        x={camara.x}
        y={camara.y}
        radius={camara.radius}
        angle={camara.angle}
        rotation={wedgeRotation(camara)}
        fill={fill}
        stroke={stroke}
        strokeWidth={(selected ? 1.05 : 0.65) * uiScale}
        listening={false}
      />

      <Line
        points={[camara.x, camara.y, asa.x, asa.y]}
        stroke={selected ? 'rgba(34,197,94,0.55)' : 'rgba(74,222,128,0.28)'}
        strokeWidth={(selected ? 0.9 : 0.65) * uiScale}
        dash={[4 * uiScale, 3 * uiScale]}
        listening={false}
      />

      <Group x={labelX} y={labelY} scaleX={uiScale} scaleY={uiScale} listening={false}>
        <LabelDistancia
          x={0}
          y={0}
          text={distLabel}
          fill={selected ? '#bbf7d0' : '#a7f3d0'}
          compact={!selected}
        />
      </Group>

      {/* Marca del ángulo FOV sobre el espectro */}
      <Group x={fovLabelX} y={fovLabelY} scaleX={uiScale} scaleY={uiScale} listening={false}>
        <Text
          x={-14}
          y={-7}
          width={28}
          align="center"
          text={fovLabel}
          fontSize={selected ? 11 : 10}
          fontStyle="bold"
          fill={selected ? '#ecfdf5' : '#d1fae5'}
          stroke="#0a0a0f"
          strokeWidth={2.5}
          fillAfterStrokeEnabled
          listening={false}
        />
      </Group>

      <Group
        x={camara.x}
        y={camara.y}
        scaleX={iconScale}
        scaleY={iconScale}
        rotation={camara.rotation}
        draggable
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onDragStart={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onDragMove={onDragBody}
        onDragEnd={onDragBody}
      >
        <Circle x={0} y={0} radius={hitR / iconScale} fill="transparent" />
        <IconoCamara selected={selected} />
      </Group>

      {camara.label ? (
        <Group
          x={camara.x + 6 * iconScale}
          y={camara.y - 10 * iconScale}
          scaleX={uiScale}
          scaleY={uiScale}
          listening={false}
        >
          <Text
            x={0}
            y={0}
            text={camara.label}
            fontSize={9}
            fill="rgba(228,228,231,0.8)"
            listening={false}
          />
        </Group>
      ) : null}
    </>
  );
}

export default function EspectroCamaraCanvas({
  width,
  height,
  camaras,
  selectedId,
  backgroundUrl,
  escala = null,
  calibrando = false,
  puntosCalibracion = [],
  onSelect,
  onChange,
  onBackgroundStatus,
  onCalibracionClick,
  className = '',
}: Props) {
  const bg = useHtmlImage(backgroundUrl, onBackgroundStatus);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const panRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const fit = bg
    ? fitContain(bg.naturalWidth || bg.width, bg.naturalHeight || bg.height, width, height)
    : null;

  const selectedCam = camaras.find((c) => c.id === selectedId) ?? null;

  const zoomIn = () => {
    if (selectedCam) {
      const screen = {
        x: selectedCam.x * view.scale + view.x,
        y: selectedCam.y * view.scale + view.y,
      };
      setView((prev) => zoomHaciaPunto(prev, ZOOM_STEP, screen));
      return;
    }
    setView((prev) => zoomHaciaCentro(prev, ZOOM_STEP, width, height));
  };
  const zoomOut = () => {
    if (selectedCam) {
      const screen = {
        x: selectedCam.x * view.scale + view.x,
        y: selectedCam.y * view.scale + view.y,
      };
      setView((prev) => zoomHaciaPunto(prev, 1 / ZOOM_STEP, screen));
      return;
    }
    setView((prev) => zoomHaciaCentro(prev, 1 / ZOOM_STEP, width, height));
  };
  const zoomReset = () => setView({ scale: 1, x: 0, y: 0 });

  const centrarEnSeleccion = () => {
    if (!selectedCam) return;
    setView((prev) => ({
      scale: Math.max(prev.scale, 2.5),
      x: width / 2 - selectedCam.x * Math.max(prev.scale, 2.5),
      y: height / 2 - selectedCam.y * Math.max(prev.scale, 2.5),
    }));
  };

  const handleStagePointer = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const native = e.evt as MouseEvent;
    const middle = 'button' in native && native.button === 1;
    const altPan = 'altKey' in native && native.altKey;
    if (middle || altPan) {
      panRef.current = { active: true, lastX: pointer.x, lastY: pointer.y };
      return;
    }

    const pos = puntoEnContenido(stage, pointer);
    if (calibrando) {
      onCalibracionClick?.(pos);
      return;
    }
    if (e.target === stage) onSelect(null);
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!panRef.current.active) return;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const dx = pointer.x - panRef.current.lastX;
    const dy = pointer.y - panRef.current.lastY;
    panRef.current.lastX = pointer.x;
    panRef.current.lastY = pointer.y;
    setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => {
    panRef.current.active = false;
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    setView((prev) => zoomHaciaPunto(prev, factor, pointer));
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-white/10 bg-[#111118] ${className}`.trim()}
      style={calibrando ? { cursor: 'crosshair' } : undefined}
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0A0A0F]/90 p-1 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={zoomOut}
          disabled={view.scale <= ZOOM_MIN + 0.001}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          title="Alejar"
          aria-label="Alejar plano"
        >
          −
        </button>
        <button
          type="button"
          onClick={zoomReset}
          className="min-w-[3.25rem] rounded-md px-1.5 py-1 text-[11px] tabular-nums text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          title="Restablecer zoom"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={view.scale >= ZOOM_MAX - 0.001}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          title="Acercar"
          aria-label="Acercar plano"
        >
          +
        </button>
        <button
          type="button"
          onClick={centrarEnSeleccion}
          disabled={!selectedCam}
          className="rounded-md px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-40"
          title="Centrar y acercar en la cámara seleccionada"
        >
          Enfocar
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-black/50 px-2 py-1 text-[10px] text-zinc-400">
        Rueda: zoom · Alt+arrastrar: pan · Arrastra el icono para mover
      </p>

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onMouseDown={handleStagePointer}
        onTouchStart={handleStagePointer}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <Layer>
          {bg && fit ? (
            <KonvaImage
              image={bg}
              x={fit.x}
              y={fit.y}
              width={fit.width}
              height={fit.height}
              opacity={0.92}
              listening={false}
            />
          ) : (
            <>
              {Array.from({ length: Math.ceil(width / 40) + 1 }, (_, i) => (
                <Line
                  key={`vx-${i}`}
                  points={[i * 40, 0, i * 40, height]}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                  listening={false}
                />
              ))}
              {Array.from({ length: Math.ceil(height / 40) + 1 }, (_, i) => (
                <Line
                  key={`hy-${i}`}
                  points={[0, i * 40, width, i * 40]}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                  listening={false}
                />
              ))}
            </>
          )}

          {calibrando && puntosCalibracion.length > 0 ? (
            <>
              {puntosCalibracion.map((p, i) => (
                <Circle
                  key={`cal-${i}`}
                  x={p.x}
                  y={p.y}
                  radius={5 / view.scale}
                  fill="#f59e0b"
                  stroke="#fff"
                  strokeWidth={1.5 / view.scale}
                  listening={false}
                />
              ))}
              {puntosCalibracion.length === 2 ? (
                <Line
                  points={[
                    puntosCalibracion[0]!.x,
                    puntosCalibracion[0]!.y,
                    puntosCalibracion[1]!.x,
                    puntosCalibracion[1]!.y,
                  ]}
                  stroke="#fbbf24"
                  strokeWidth={2 / view.scale}
                  listening={false}
                />
              ) : null}
            </>
          ) : null}

          {!calibrando
            ? camaras.map((c) => (
                <CamaraNode
                  key={c.id}
                  camara={c}
                  selected={c.id === selectedId}
                  escala={escala}
                  viewScale={view.scale}
                  onSelect={() => onSelect(c.id)}
                  onChange={(patch) => onChange(c.id, patch)}
                />
              ))
            : null}
        </Layer>
      </Stage>
    </div>
  );
}
