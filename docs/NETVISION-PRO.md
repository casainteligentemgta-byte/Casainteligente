# NetVision Pro

Diseño CCTV / redes / cableado / subterráneo / normativas / BIM en Nexus (`/nexus/vision`).

**Manuales:**

- Explicativo (visión de producto): [`NETVISION-PRO-MANUAL.md`](./NETVISION-PRO-MANUAL.md) → [`/nexus/vision/manual`](/nexus/vision/manual)
- Usuario (paso a paso): [`NETVISION-PRO-USER-MANUAL.md`](./NETVISION-PRO-USER-MANUAL.md) → [`/nexus/vision/manual/usuario`](/nexus/vision/manual/usuario)
- Guía rápida instaladores: [`NETVISION-PRO-INSTALLER-GUIDE.md`](./NETVISION-PRO-INSTALLER-GUIDE.md) → [`/nexus/vision/manual/instaladores`](/nexus/vision/manual/instaladores)

## Fases implementadas

### 1 — CCTV
FOV, catálogo multi-marca, calibración, BOM base, exports JSON/CSV/PNG/PDF.
**Marcas:** Hikvision, Axis, Uniview, Dahua, Sony, Ezviz (catálogo amplio), Aqara (catálogo amplio).
Agregar cámara con botón **+ Cámara** (no por clic en el plano); luego arrastrar el pin.
Espectro de visión ajustable por cámara: orientación, apertura FOV y alcance (sliders + asas en el plano).
Cámaras **Dual** (p. ej. Ezviz H9c): dos conos/espectros — gran angular (cyan) + tele (naranja).
**Calcular cobertura**: semáforo por alcance — verde (detección objetos/personas ≤40%), amarillo (≤70%), rojo (visión dudosa hasta 100%).
Guía rápida de capas (Visión / WiFi / Sonido / Enlaces / Rutas / Sub / Noche): botón **?** en la barra del plano (`NetVisionLayerHelp`).

### 1b — Muros / materiales
Pestaña **Muros**: drywall, bloque, **concreto**, vidrio, ventana, **puerta** (2 toques); arrastrar segmento o extremos. Capa **Estructuras** (checkbox) muestra/oculta en el plano; lista colapsable en el panel. Drywall/bloque/concreto cortan FOV (el espectro no atraviesa); aberturas no.
- Drywall/bloque/concreto cortan FOV; vidrio/ventana dejan ver.
- WiFi y Sonido usan mapa de calor atenuado por material (`structureAttenuation`, `buildWifiSpectrum`, `buildSoundSpectrum`).

### 2 — Redes
Switches PoE, APs WiFi, NVR, injectors, canales, presupuesto PoE.
Botones **+ Switch / + AP / + NVR / + Injector** agregan el equipo al plano de inmediato (igual que + Cámara); luego arrastrar.

### 3 — Diagrama
Unifilar en tiempo real (Plano/Diagrama) + SVG/PNG.

### 4 — Cableado
Dibujo en el plano (2 toques) con tipo Cat5e / Cat6 / Cat6A / fibra / sonido / 12V; rutas auto cámara→PoE con **varios quiebres** (tocar línea / arrastrar puntos / + Añadir quiebre); cajetines; BOM.

### 5 — Subterráneo
Dibujo de tramos en el plano (2 toques) + auto desde cable ≥ 8 m; profundidad por zona, tubería, cámaras de acceso, excavación, perfil 2D.

### 6 — Normativas
- Pestaña **Norm**: país/región → perfiles NEC / IEC / NFPA / TIA / ISO27001
- Validación en tiempo real al editar cables/diseño
- Matriz CSV + PDF de cumplimiento (asistencia de ingeniería)

### 7 — BIM
- Exportador en `lib/netvision/services/bimExporter` (JSON + IFC-lite + CSV + Dynamo); sin pestaña en la UI
- `.RVT` nativo requiere worker/add-in (no en browser)

### 8 — Proyectos, preferencias y BOM
- **Mis proyectos**: biblioteca local (`localStorage`) — crear, abrir, renombrar, eliminar; nombre/cliente/descripción
- Pestaña **Prefs**: sistema de unidades (métrico / imperial / mixto), divisa (USD/VES/EUR), margen distribuidor
- Cálculos internos en metros; UI de calibración y alcances formateados según unidades
- BOM: CSV + Excel (SpreadsheetML `.xls`) con margen y total

### 9 — Persistencia Supabase
- Tabla `netvision_projects` (migración `274_netvision_projects.sql`) con RLS por `auth.uid()`
- API: `GET/PUT/DELETE /api/netvision/projects` y `/api/netvision/projects/[id]`
- UI: **Subir nube** / listar nube / abrir desde Supabase; autoguardado diferido si hay sesión
- Planos muy grandes (>~450KB data URL) se omiten en la nube; el diseño y el plano local se conservan

## Estructura

- `components/netvision/*` — UI (CameraPlacementTool, NetworkDesigner, DiagramGenerator, CableRoutingEngine, ConduitCalculator, UndergroundCanalizationTool, ComplianceValidator, BIMViewer, BOMGenerator, NetVisionProjectsPanel, NetVisionPrefsPanel)
- `lib/netvision/services/*` — motores
- `lib/netvision/utils/units.ts` — conversiones de visualización
- Re-exports plan: `lib/netvision/coverage.ts`, `bom.ts`, `underground.ts`
- `data/netvision/*` — JSON (equipment, cables, conduits, underground, normatives, countries)
- Mapa de fases: `components/netvision/stubs.tsx` → `NETVISION_ROADMAP_STATUS`

## Persistencia

- Activo: `sessionStorage` `nexus.netvision.v1`
- Biblioteca: `localStorage` `nexus.netvision.library.v1` + `nexus.netvision.activeId.v1`
- Nube: `public.netvision_projects` (por usuario autenticado)
- Migra legacy `nexus.vision.architect.v1/v2`

## Fuera de alcance (plan)

Motor RF Ekahau-level, import CAD nativo, Visio/VSDX, `.RVT` nativo en browser, colaboración simultánea multi-usuario, Loxone/Crestron, AR.
