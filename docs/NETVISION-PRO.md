# NetVision Pro

Diseño CCTV / redes / cableado / subterráneo / normativas / BIM en Nexus (`/nexus/vision`).

## Fases implementadas

### 1 — CCTV
FOV, catálogo multi-marca, calibración, BOM base, exports JSON/CSV/PNG/PDF.

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

- `components/netvision/*` — UI
- `lib/netvision/services/*` — motores
- `data/netvision/*` — JSON (equipment, cables, conduits, underground, normatives, countries)

## Persistencia

`sessionStorage` clave `nexus.netvision.v1`.
