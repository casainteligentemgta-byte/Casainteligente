# NetVision Pro

Diseño CCTV / redes / cableado / BIM integrado en Nexus (`/nexus/vision`).

## Fase 1 (actual)

- Drag-and-drop de cámaras sobre plano PDF/imagen (Konva)
- Catálogo Hikvision / Axis / Uniview / Dahua (`data/netvision/equipment.json`)
- Conos FOV día/noche, calibración de escala, yaw / altura
- Validación de cobertura / redundancia / bordes
- BOM (PoE, BW, storage, NVR) + export CSV / JSON / PNG / PDF specs
- Persistencia `sessionStorage` (`nexus.netvision.v1`, migra v1/v2 legacy)

## Estructura

- `components/netvision/*` — UI
- `lib/netvision/services/*` — motores
- `lib/netvision/utils/*` — geometría / exporters
- `data/netvision/*` — catálogos JSON (cables, conductos, normas, países)

## Roadmap

| Fase | Módulo |
|------|--------|
| 2 | Redes WiFi + Ethernet + PoE |
| 3 | Diagramas técnicos automáticos |
| 4 | Cableado, cajetines, BOM completo |
| 5 | Canalizaciones subterráneas / excavación |
| 6 | Cumplimiento NEC/IEC/NFPA/TIA + reportes |
| 7 | BIM IFC/DWG/paquete Revit + Dynamo |

Stubs: `components/netvision/stubs.tsx` y services `cableCalculator`, `canalizationCalculator`, `bimExporter`, `complianceValidator`.
