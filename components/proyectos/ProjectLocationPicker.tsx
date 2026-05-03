'use client';

/** Si cargas este módulo con `next/dynamic`, importa `leaflet/dist/leaflet.css` en la página para no generar un chunk CSS asíncrono. */
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

type PickValue = {
  lat: number;
  lng: number;
  label?: string;
};

type Props = {
  lat?: number | null;
  lng?: number | null;
  onChange: (v: PickValue) => void;
};

const DEFAULT_CENTER: [number, number] = [10.4806, -66.9036];

function crearIconoMarcador() {
  return new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Tras `dynamic()` / cambio de layout, Leaflet a veces calcula mal el tamaño hasta `invalidateSize`. */
function InvalidateSizeOnReady() {
  const map = useMap();
  useEffect(() => {
    const fix = () => {
      map.invalidateSize({ animate: false });
    };
    fix();
    const t0 = window.setTimeout(fix, 50);
    const t1 = window.setTimeout(fix, 250);
    window.addEventListener('resize', fix);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

export default function ProjectLocationPicker({ lat, lng, onChange }: Props) {
  const pin = useMemo(() => crearIconoMarcador(), []);
  const [q, setQ] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  /** Una clave estable por montaje del componente (Strict Mode remonta = nueva instancia). */
  const mapLeafletKey = useRef(
    `leaflet-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`,
  );
  /** No montar MapContainer en el primer paint: evita doble init con Strict Mode / HMR. */
  const [mapDomReady, setMapDomReady] = useState(false);
  const center = useMemo<[number, number]>(() => {
    if (lat != null && lng != null) return [lat, lng];
    return DEFAULT_CENTER;
  }, [lat, lng]);

  useEffect(() => {
    const styleEl = document.getElementById('leaflet-inline-size-fix');
    if (!styleEl) {
      const el = document.createElement('style');
      el.id = 'leaflet-inline-size-fix';
      el.innerHTML = '.leaflet-container{width:100%;height:100%;}';
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      if (alive) setMapDomReady(true);
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  async function buscarDireccion() {
    const qq = q.trim();
    if (!qq) return;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(qq)}&limit=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const first = data[0];
    if (!first) return;
    onChange({ lat: Number(first.lat), lng: Number(first.lon), label: first.display_name });
  }

  function usarUbicacionActual() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Tu dispositivo/navegador no soporta geolocalización.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        onChange({ lat: la, lng: ln });
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Permiso de ubicación denegado. Actívalo en tu navegador.');
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError('Ubicación no disponible en este momento.');
          return;
        }
        if (err.code === err.TIMEOUT) {
          setGeoError('Tiempo de espera agotado al obtener GPS.');
          return;
        }
        setGeoError('No se pudo obtener la ubicación.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-[260px] flex-1 gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar direccion o referencia..."
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
          />
          <button
            type="button"
            onClick={() => void buscarDireccion()}
            className="rounded-xl bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0062CC]"
          >
            Buscar
          </button>
        </div>
        <button
          type="button"
          onClick={usarUbicacionActual}
          disabled={geoLoading}
          className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/15 disabled:opacity-60"
        >
          {geoLoading ? 'Tomando GPS...' : 'Usar mi ubicación actual'}
        </button>
      </div>
      <div className="relative z-0 h-72 w-full min-h-[18rem] overflow-hidden rounded-xl border border-white/10">
        {mapDomReady ? (
          <MapContainer
            key={mapLeafletKey.current}
            className="h-full w-full !bg-zinc-900"
            style={{ minHeight: '100%' }}
            center={center}
            zoom={13}
            scrollWheelZoom
          >
            <InvalidateSizeOnReady />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickCapture
              onPick={(a, b) => {
                onChange({ lat: a, lng: b });
              }}
            />
            {lat != null && lng != null ? <Marker icon={pin} position={[lat, lng]} /> : null}
          </MapContainer>
        ) : (
          <div className="flex h-full min-h-[18rem] items-center justify-center bg-zinc-900/80 text-xs text-zinc-500">
            Preparando mapa…
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-400">
        Haz clic en el mapa para fijar coordenadas GPS del proyecto.
      </p>
      {geoError ? <p className="text-xs text-red-400">{geoError}</p> : null}
      <p className="text-[11px] text-zinc-500">
        En móvil/tablet permite ubicación para que latitud y longitud se completen automáticamente.
      </p>
    </div>
  );
}
