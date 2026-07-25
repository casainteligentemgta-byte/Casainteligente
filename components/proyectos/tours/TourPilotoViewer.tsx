'use client';

import { useEffect, useRef, useState } from 'react';
import VirtualJoystickPad from '@/components/proyectos/tours/VirtualJoystickPad';
import { useTourJoystick, type JoystickAxes } from '@/components/proyectos/tours/useTourJoystick';

type Props = {
  modeloUrl: string | null;
  titulo?: string;
};

type Pose = { x: number; y: number; z: number; yaw: number };

const ZERO_V = { forward: 0, strafe: 0, yaw: 0, vertical: 0 };

/**
 * Modo piloto: joysticks virtuales + Gamepad API.
 * Vista procedural hasta cablear el cargador glTF/splat del worker.
 */
export default function TourPilotoViewer({ modeloUrl, titulo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose>({ x: 0, y: 1.6, z: 0, yaw: 0 });
  const [movePad, setMovePad] = useState(ZERO_V);
  const [lookPad, setLookPad] = useState(ZERO_V);
  const virtual: Omit<JoystickAxes, 'source'> = {
    forward: movePad.forward || 0,
    strafe: movePad.strafe || 0,
    yaw: lookPad.yaw || 0,
    vertical: lookPad.vertical || 0,
  };
  const axes = useTourJoystick(virtual);
  const axesRef = useRef(axes);
  axesRef.current = axes;
  const modeloRef = useRef(modeloUrl);
  modeloRef.current = modeloUrl;
  const [hud, setHud] = useState({ source: 'none' as JoystickAxes['source'], yawDeg: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 640;
      const h = Math.max(280, Math.round(w * 0.55));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const axesNow = axesRef.current;
      const pose = poseRef.current;
      const speed = 4.5;
      const turn = 1.8;
      const sin = Math.sin(pose.yaw);
      const cos = Math.cos(pose.yaw);
      pose.x += (axesNow.forward * cos + axesNow.strafe * sin) * speed * dt;
      pose.z += (axesNow.forward * sin - axesNow.strafe * cos) * speed * dt;
      pose.yaw += axesNow.yaw * turn * dt;
      pose.y = Math.max(0.4, Math.min(8, pose.y + axesNow.vertical * 2.2 * dt));
      poseRef.current = pose;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#0b1220');
      sky.addColorStop(0.45, '#1a2740');
      sky.addColorStop(0.45, '#2a3344');
      sky.addColorStop(1, '#12161e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const horizon = h * 0.45;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.lineWidth = 1;
      for (let i = -12; i <= 12; i++) {
        const worldX = i * 2 - (pose.x % 2);
        const angle = Math.atan2(worldX, 8) - pose.yaw * 0.15;
        const x0 = w / 2 + Math.tan(angle) * (w * 0.4);
        ctx.beginPath();
        ctx.moveTo(w / 2, horizon);
        ctx.lineTo(x0, h);
        ctx.stroke();
      }
      for (let row = 1; row <= 10; row++) {
        const t = row / 10;
        const y = horizon + (h - horizon) * (t * t);
        ctx.globalAlpha = 0.25 + t * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const blocks = [
        { x: 4, z: 6, s: 1.2 },
        { x: -3, z: 10, s: 1.6 },
        { x: 8, z: 14, s: 1 },
        { x: -6, z: 18, s: 1.4 },
      ];
      for (const b of blocks) {
        const dx = b.x - pose.x;
        const dz = b.z - pose.z;
        const relX = dx * Math.cos(-pose.yaw) - dz * Math.sin(-pose.yaw);
        const relZ = dx * Math.sin(-pose.yaw) + dz * Math.cos(-pose.yaw);
        if (relZ < 0.8) continue;
        const scale = (180 * b.s) / relZ;
        const sx = w / 2 + (relX / relZ) * (w * 0.55);
        const sy = horizon - scale * 0.35 + (1.6 - pose.y) * 12;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
        ctx.fillRect(sx - scale / 2, sy - scale, scale, scale);
        ctx.strokeRect(sx - scale / 2, sy - scale, scale, scale);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText(
        `Piloto · x ${pose.x.toFixed(1)}  z ${pose.z.toFixed(1)}  alt ${pose.y.toFixed(1)}  yaw ${(
          (pose.yaw * 180) /
          Math.PI
        ).toFixed(0)}°`,
        12,
        22,
      );
      if (modeloRef.current) {
        ctx.fillStyle = 'rgba(167, 243, 208, 0.9)';
        ctx.fillText('Modelo listo — visor glTF/splat se conecta al URL del job', 12, 40);
      } else {
        ctx.fillStyle = 'rgba(253, 230, 138, 0.9)';
        ctx.fillText('Sin modelo aún — escena de práctica con joystick', 12, 40);
      }

      hudAcc += dt;
      if (hudAcc > 0.2) {
        hudAcc = 0;
        setHud({
          source: axesNow.source,
          yawDeg: (pose.yaw * 180) / Math.PI,
        });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            {titulo ?? 'Modo piloto'}
          </h3>
          <p className="text-[11px] text-zinc-500">
            Joystick virtual o mando Bluetooth/USB · entrada:{' '}
            <span className="text-amber-200/90">{hud.source}</span>
            {' · '}
            yaw {hud.yawDeg.toFixed(0)}°
          </p>
        </div>
        {modeloUrl ? (
          <a
            href={modeloUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-sky-300 hover:underline"
          >
            Abrir modelo
          </a>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
        <canvas ref={canvasRef} className="block w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 px-2 pb-1">
        <VirtualJoystickPad
          label="Movimiento"
          mode="move"
          onChange={(a) => setMovePad(a)}
        />
        <VirtualJoystickPad
          label="Mirada / altura"
          mode="look"
          onChange={(a) => setLookPad(a)}
        />
      </div>
    </div>
  );
}
