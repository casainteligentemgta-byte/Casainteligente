'use client';

import { useEffect, useRef, useState } from 'react';

export type JoystickAxes = {
  /** -1..1 adelante/atrás */
  forward: number;
  /** -1..1 strafe izquierda/derecha */
  strafe: number;
  /** -1..1 yaw */
  yaw: number;
  /** -1..1 subir/bajar */
  vertical: number;
  /** origen del input */
  source: 'none' | 'virtual' | 'gamepad';
};

const ZERO: JoystickAxes = {
  forward: 0,
  strafe: 0,
  yaw: 0,
  vertical: 0,
  source: 'none',
};

function deadzone(v: number, dz = 0.12): number {
  if (Math.abs(v) < dz) return 0;
  const s = Math.sign(v);
  return s * Math.min(1, (Math.abs(v) - dz) / (1 - dz));
}

/**
 * Combina joystick virtual (touch) + Gamepad API (mando/joystick Bluetooth-USB).
 */
export function useTourJoystick(virtual: Omit<JoystickAxes, 'source'>) {
  const [axes, setAxes] = useState<JoystickAxes>(ZERO);
  const virtualRef = useRef(virtual);
  virtualRef.current = virtual;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
      let gp: JoystickAxes | null = null;
      if (pads) {
        for (const p of pads) {
          if (!p || !p.connected) continue;
          // Stick izq: ejes 0/1; stick der: 2/3; botones hombro vertical opcionales
          const strafe = deadzone(p.axes[0] ?? 0);
          const forward = deadzone(-(p.axes[1] ?? 0));
          const yaw = deadzone(p.axes[2] ?? 0);
          const vertical = deadzone(-(p.axes[3] ?? 0));
          if (strafe || forward || yaw || vertical) {
            gp = { forward, strafe, yaw, vertical, source: 'gamepad' };
            break;
          }
        }
      }

      const v = virtualRef.current;
      const hasVirtual = v.forward || v.strafe || v.yaw || v.vertical;
      const next: JoystickAxes = gp
        ? gp
        : hasVirtual
          ? { ...v, source: 'virtual' }
          : ZERO;

      setAxes((prev) =>
        prev.forward === next.forward &&
        prev.strafe === next.strafe &&
        prev.yaw === next.yaw &&
        prev.vertical === next.vertical &&
        prev.source === next.source
          ? prev
          : next,
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return axes;
}
