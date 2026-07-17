# NetVision Pro

Diseño CCTV / redes / cableado / BIM integrado en Nexus (`/nexus/vision`).

## Fase 1 — CCTV

- Drag-and-drop de cámaras sobre plano PDF/imagen (Konva)
- Catálogo Hikvision / Axis / Uniview / Dahua (`data/netvision/equipment.json`)
- Conos FOV día/noche, calibración de escala, yaw / altura
- Validación de cobertura / redundancia / bordes
- BOM (PoE, BW, storage, NVR) + export CSV / JSON / PNG / PDF specs
- Persistencia `sessionStorage` (`nexus.netvision.v1`)

## Fase 2 — Redes (actual)

- Nodos en plano: **switch PoE**, **AP WiFi**, **NVR**, **injector**
- Catálogo de red en `equipment.json` → `network[]`
- Cobertura WiFi (path-loss log-distance) + círculos en canvas
- Optimización heurística de canales 2.4/5 GHz
- Auto-asignación cámara → nodo PoE más cercano
- Presupuesto PoE (W y puertos) con alertas
- Enlaces visuales + recomendación Cat6/Cat6A/fibra por distancia
- BOM incluye equipos de red / WiFi / injectors por déficit

### UI

- Pestaña **CCTV** / **Red** en el panel lateral
- Toggles: FOV, WiFi, Enlaces
- Botones: Auto-asignar PoE, Optimizar canales

## Estructura

- `components/netvision/*` — UI
- `lib/netvision/services/*` — motores (`poeAnalyzer`, `wifiPredictor`, `channelOptimizer`, …)
- `lib/netvision/catalog/network.ts` — catálogo switches/APs
- `data/netvision/*` — JSON

## Roadmap

| Fase | Módulo | Estado |
|------|--------|--------|
| 1 | CCTV FOV / BOM | Hecho |
| 2 | Redes WiFi + Ethernet + PoE | Hecho |
| 3 | Diagramas técnicos automáticos | Pendiente |
| 4 | Cableado, cajetines, BOM completo | Pendiente |
| 5 | Canalizaciones subterráneas | Pendiente |
| 6 | Cumplimiento NEC/IEC/NFPA/TIA | Stub |
| 7 | BIM IFC/DWG/paquete Revit | Stub |
