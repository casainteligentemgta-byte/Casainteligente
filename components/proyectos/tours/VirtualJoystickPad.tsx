'use client';

import { useCallback, useRef, useState } from 'react';

type Props = {
  label: string;
  /** 'move' → forward/strafe; 'look' → yaw/vertical */
  mode: 'move' | 'look';
  onChange: (axes: { forward: number; strafe: number; yaw: number; vertical: number }) => void;
  className?: string;
};

/**
 * Joystick virtual táctil/mouse para modo piloto.
 */
export default function VirtualJoystickPad({ label, mode, onChange, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const emit = useCallback(
    (nx: number, ny: number) => {
      if (mode === 'move') {
        onChange({ forward: -ny, strafe: nx, yaw: 0, vertical: 0 });
      } else {
        onChange({ forward: 0, strafe: 0, yaw: nx, vertical: -ny });
      }
    },
    [mode, onChange],
  );

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const max = Math.min(r.width, r.height) * 0.38;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const mag = Math.hypot(dx, dy);
      if (mag > max) {
        dx = (dx / mag) * max;
        dy = (dy / mag) * max;
      }
      setKnob({ x: dx, y: dy });
      emit(dx / max, dy / max);
    },
    [emit],
  );

  const end = useCallback(() => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onChange({ forward: 0, strafe: 0, yaw: 0, vertical: 0 });
  }, [onChange]);

  return (
    <div className={className}>
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div
        ref={rootRef}
        className="relative mx-auto h-28 w-28 touch-none select-none rounded-full border border-white/15 bg-zinc-950/80 shadow-inner"
        onPointerDown={(e) => {
          active.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!active.current) return;
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        role="application"
        aria-label={label}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/50 bg-amber-500/30"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
    </div>
  );
}
