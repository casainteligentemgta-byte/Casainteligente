# NetVision Pro

Diseño CCTV / redes / cableado / subterráneo / normativas / BIM en Nexus (`/nexus/vision`).

## Fases implementadas

### 1 — CCTV
FOV, catálogo multi-marca, calibración, BOM base, exports JSON/CSV/PNG/PDF.
Agregar cámara con botón **+ Cámara** (no por clic en el plano); luego arrastrar el pin.
Guía rápida de capas (FOV / WiFi / Enlaces / Rutas / Sub / Noche): botón **?** en la barra del plano (`NetVisionLayerHelp`).

### 2 — Redes
Switches PoE, APs WiFi, NVR, injectors, canales, presupuesto PoE.

### 3 — Diagrama
Unifilar en tiempo real (Plano/Diagrama) + SVG/PNG.

### 4 — Cableado
Rutas ortogonales, Cat6/Cat6A/fibra, cajetines, BOM cables/RJ45.

### 5 — Subterráneo
Profundidad por zona, tubería, cámaras de acceso, excavación, perfil 2D.

### 6 — Normativas
- Pestaña **Norm**: país/región → perfiles NEC / IEC / NFPA / TIA / ISO27001
- Validación en tiempo real al editar cables/diseño
- Matriz CSV + PDF de cumplimiento (asistencia de ingeniería)

### 7 — BIM
- Pestaña **BIM**: elementos por fase Revit (diseño/cableado/equipamiento/docs)
- Export paquete: JSON + IFC-lite + shared parameters CSV + script Dynamo
- `.RVT` nativo requiere worker/add-in (no en browser)

## Estructura

- `components/netvision/*` — UI (CameraPlacementTool, NetworkDesigner, DiagramGenerator, CableRoutingEngine, ConduitCalculator, UndergroundCanalizationTool, ComplianceValidator, BIMViewer, BOMGenerator)
- `lib/netvision/services/*` — motores
- Re-exports plan: `lib/netvision/coverage.ts`, `bom.ts`, `underground.ts`
- `data/netvision/*` — JSON (equipment, cables, conduits, underground, normatives, countries)
- Mapa de fases: `components/netvision/stubs.tsx` → `NETVISION_ROADMAP_STATUS`

## Persistencia

`sessionStorage` clave `nexus.netvision.v1` (migra legacy `nexus.vision.architect.v1/v2`).

## Fuera de alcance (plan)

Motor RF Ekahau-level, import CAD nativo, Visio/VSDX, `.RVT` nativo en browser, Supabase multi-usuario, Loxone/Crestron, AR.
