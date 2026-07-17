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

## Fase 3 — Diagrama unifilar

- Vista **Plano / Diagrama** en el editor
- Grafo jerárquico: CORE/NVR → Switch/Injector → AP → Cámaras
- Enlaces con metros + tipo de cable; se regenera al mover equipos
- Export **SVG** y **PNG** del esquema
- Click en nodo del diagrama → selecciona en el inspector

## Fase 4 — Cableado y conductos

- Rutas ortogonales en plano (toggle **Rutas**) con holgura 15%
- Tipo de cable Cat6/Cat6A/fibra por distancia + alertas TIA 100 m
- Cajetines automáticos (16/20/25 mm, ducto 40×40) ocupación ≤40%
- Pestaña **Cable**: lista de rutas + plan de conductos
- BOM: cables ($/m), RJ45, cajetines, corrugado

## Roadmap

| Fase | Módulo | Estado |
|------|--------|--------|
| 1 | CCTV FOV / BOM | Hecho |
| 2 | Redes WiFi + Ethernet + PoE | Hecho |
| 3 | Diagramas técnicos automáticos | Hecho |
| 4 | Cableado, cajetines, BOM completo | Hecho |
| 5 | Canalizaciones subterráneas | Pendiente |
| 6 | Cumplimiento NEC/IEC/NFPA/TIA | Stub |
| 7 | BIM IFC/DWG/paquete Revit | Stub |
