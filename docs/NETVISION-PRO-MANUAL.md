# Manual explicativo: NetVision Pro

> **Nota:** Este manual describe la visión y el uso de NetVision Pro. El estado técnico de lo implementado en la app (y lo que queda fuera de alcance) está en [`NETVISION-PRO.md`](./NETVISION-PRO.md). Abrir en la app: [`/nexus/vision/manual`](/nexus/vision/manual).

## ¿Qué es NetVision Pro?

NetVision Pro es una **plataforma web profesional enterprise** diseñada para ingenieros, técnicos e instaladores que necesitan diseñar, planificar y documentar proyectos de:

- **Sistemas CCTV** (cámaras de vigilancia IP)
- **Redes de datos** (Ethernet, WiFi, Fibra óptica)
- **Automatización inteligente** (domótica, control)
- **Infraestructura de cableado estructurado**
- **Canalizaciones subterráneas** (ductos enterrados)

---

## Objetivos principales

| Problema | Solución NetVision Pro |
|----------|------------------------|
| Diseño manual sin validación | Validación automática en tiempo real |
| Cálculos manuales (metros de cable) | Cálculo automático de distancias |
| Especificaciones confusas | Diagrama técnico generado automáticamente |
| No cumple normativas | Valida NEC, IEC, NFPA, TIA/EIA |
| Presupuestos imprecisos | BOM automática con cotizaciones |
| No integra con software profesional | Exporta a Revit/BIM, IFC, PDF, Excel |
| Falta documentación | Genera reportes ejecutivos automáticos |

---

## Módulos principales

### 1. Módulo de diseño CCTV

Permite diseñar sistemas de vigilancia de forma visual e inteligente.

**Funcionalidades:**

- Drag-drop de cámaras en un plano
- Cálculo automático de cobertura (ángulos, resolución, alcance)
- Compatibilidad con marcas: Hikvision, Axis, Uniview, Dahua, Sony (y catálogo ampliable)
- Detección de puntos ciegos
- Validación de redundancia (cámaras de respaldo)
- Especificaciones técnicas automáticas (PoE, ancho de banda, almacenamiento)

**Ejemplo:**

```
Arrastra cámara Hikvision DS-2CD2647FWD al plano
↓
La app calcula automáticamente:
  • Cobertura: 106° horizontal x 59° vertical
  • Resolución: 4MP (2688×1520)
  • Consumo PoE: 7.8W
  • Distancia máxima al switch: 100m
  • Puntos ciegos detectados: 2 (advertencia)
```

---

### 2. Módulo de diseño de redes

Diseña redes WiFi y Ethernet optimizadas.

**Funcionalidades:**

- Posicionamiento inteligente de Access Points (APs)
- Cálculo de cobertura WiFi con predicción de señal
- Detección de interferencias
- Posicionamiento de switches y routers
- Cálculo de PoE injectors necesarios
- Análisis de ancho de banda requerido

**Ejemplo:**

```
Selecciona "Agregar AP WiFi 6"
↓
Especifica: zona de cobertura deseada (500m²)
↓
La app sugiere automáticamente:
  • Ubicación óptima: Centro de la zona
  • Potencia recomendada: 20dBm (máxima)
  • Canales: 1, 6, 11 (sin interferencia)
  • Cobertura prevista: 95% (según materiales)
  • Costo estimado: $350
```

---

### 3. Módulo inteligente de cableado

Calcula automáticamente lo relacionado con cables y conductos.

#### 3.1 Cálculo de metros de cable

- Distancia automática entre dispositivos
- Recomendación de tipo de cable:
  - **CAT5E**: hasta 100m (instalaciones antiguas)
  - **CAT6**: hasta 100m con PoE (estándar CCTV)
  - **CAT6A**: hasta 100m con PoE 90W (cámaras 4K)
  - **Fibra óptica**: para distancias >100m
  - **Coaxial RG-6**: para cámaras analógicas (legacy)
- Cálculo de pérdida de señal
- Validación automática si supera especificaciones

**Ejemplo:**

```
Conectas: Cámara A → Switch Principal
Distancia: 87 metros
↓
La app recomienda:
  Cable: CAT6A UTP
  Metros: 87m @ $0.15/m = $13.05
  Pérdida de señal: 2.1dB (aceptable)
  PoE requerido: 7.8W (disponible)
  Repetidor: NO necesario
```

#### 3.2 Cálculo de cajetines

- Regla automática: máximo 40% ocupación
- Selector de tamaño:
  - **Cajetín 16mm (PVC)**: hasta 4 cables CAT6
  - **Cajetín 20mm (PVC)**: hasta 8 cables CAT6
  - **Cajetín 25mm (PVC)**: hasta 12 cables CAT6
  - **Ducto 40x40mm**: para >15 cables

**Ejemplo:**

```
En un punto de conexión tienes: 6 cables CAT6
↓
La app calcula:
  Ocupación: 6 cables = 37.5% de capacidad
  Cajetín recomendado: 25mm
  Disponible para futuro: 6 cables más
  Costo: $3.50
```

#### 3.3 Rutas inteligentes de cable

- Traza automática en plano 2D
- Cálculo de metros reales (no solo línea recta)
- Evita obstáculos y paredes
- Sugiere rutas óptimas
- Evita interferencias (alto voltaje, motores)

#### 3.4 Generador automático de BOM (lista de materiales)

- Lista completa de materiales
- Cantidades exactas
- Precios unitarios y totales
- Exporta a Excel/CSV para proveedores

**Ejemplo de BOM:**

```
═══════════════════════════════════════════
        LISTA DE MATERIALES (BOM)
      Proyecto: Centro Comercial CCTV
      Fecha: 15-Enero-2025
═══════════════════════════════════════════

CABLES
─────────────────────────────────────────
CAT6A UTP (305m carrete)      4 carretes  $0.15/m  = $432.00
CAT6 UTP (305m carrete)       2 carretes  $0.12/m  = $183.60
Fibra Monomodo (1km carrete)  1 carrete   $0.50/m  = $75.00
                                    SUBTOTAL = $690.60

CONECTORES
─────────────────────────────────────────
RJ45 Cat6A (paquete 50)       3 paquetes  $0.50/u  = $75.00
Conectores Fibra LC           12 piezas   $2.00/u  = $24.00
                                    SUBTOTAL = $99.00

CONDUCTOS Y CAJETINES
─────────────────────────────────────────
Cajetín PVC 16mm (gris)       20 piezas   $2.00/u  = $40.00
Cajetín PVC 20mm (gris)       35 piezas   $2.50/u  = $87.50
Cajetín PVC 25mm (gris)       15 piezas   $3.00/u  = $45.00
Ducto 40x40mm PVC (50m)       3 rollos    $45.00/u = $135.00
Corrugado protector 6mm (200m)1 carrete   $0.08/m  = $16.00
                                    SUBTOTAL = $323.50

ACCESORIOS
─────────────────────────────────────────
PoE Injector 90W (Gigabit)    8 piezas    $35.00/u = $280.00
Fiber Patch Panel 24 puertos  1 pieza     $450.00/u= $450.00
RJ45 Feed Through (CAT6A)     4 piezas    $12.00/u = $48.00
Tubing Termocontraíble        2 paquetes  $15.00/u = $30.00
                                    SUBTOTAL = $808.00

═══════════════════════════════════════════
TOTAL MATERIALES                        = $1,921.10
MARGEN DISTRIBUIDOR (15%)               = $288.17
TOTAL FACTURACIÓN                       = $2,209.27
═══════════════════════════════════════════
```

---

### 4. Módulo avanzado de canalizaciones subterráneas

Diseña y calcula conductos enterrados para proyectos grandes (escuelas, hospitales, estadios).

#### 4.1 Selección automática de tubería

Basado en: distancia, zona, cantidad de cables.

| Tipo tubería | Diámetro | Profundidad | Costo/m | Uso |
|---|---|---|---|---|
| PVC rígido | 50-110mm | 30-100cm | $2.00 | Zonas peatonales |
| HDPE flexible | 25-160mm | 30-200cm | $1.50 | Terreno irregular |
| Acero corrugado | 60-300mm | 50-300cm | $4.00 | Zona vehicular |
| Fibra óptica | 16-40mm | 20-100cm | $3.00 | Datos críticos |
| Hormigón armado | 100-400mm | 80-400cm | $6.00 | Proyectos mega |

#### 4.2 Profundidad automática por normativa

- Zona peatonal: 30cm mínimo
- Zona vehicular: 60cm mínimo
- Cruce de carreteras: 80cm mínimo
- Bajo ferrocarril: 120cm mínimo
- Validación automática según país/región

#### 4.3 Cámaras de acceso (pozos)

- Cálculo automático de cantidad y ubicación
- Máximo 30m entre cámaras
- En cada cambio de dirección >30°
- Especificaciones: diámetro, profundidad, material

**Ejemplo:**

```
Canalización subterránea: Piscina → Centro Control
Distancia: 150 metros
Zona: 100m peatonal + 50m cruce carretera
Cables: 4x CAT6A + 2x Fibra
↓
La app calcula:
  SECCIÓN PEATONAL (100m):
    • Tubería: PVC 110mm @ 30cm
    • Costo: 100m × $2.00 = $200.00
    • Cámaras: 3 (c/30m)

  SECCIÓN CARRETERA (50m):
    • Tubería: Acero 150mm @ 80cm
    • Costo: 50m × $4.00 = $200.00
    • Cámaras: 2 (c/25m)

  TUBO INTERIOR (tiro de cables):
    • HDPE 40mm @ 150m
    • Costo: 150m × $1.50 = $225.00

  CÁMARAS DE ACCESO:
    • 5 cámaras Ø60cm
    • Costo: 5 × $150 = $750.00

  PROTECCIONES Y ACCESORIOS:
    • Arena compactada: 2.5m³ = $62.50
    • Geotextil: 200m² = $160.00

  TOTAL CANALIZACIÓN: $1,597.50
```

---

### 5. Módulo de validación normativa

Valida automáticamente que el diseño cumpla con normativas internacionales (asistencia de ingeniería; no sustituye dictamen legal).

#### 5.1 Normativas soportadas

**NEC (National Electrical Code — USA)**

- Máxima distancia PoE: 100m sin repetidor
- Cable debe ser UL Listed
- Separación mínima de alto voltaje: 30cm
- Grounding cada 20m en ducto metálico
- Máxima tensión durante instalación: 25 libras

**IEC (International Electrotechnical Commission — Europa / internacional)**

- Impedancia coaxial: 75Ω ±5%
- Máxima distancia HDMI: 15m
- Capacitancia: <50pF/m
- Separación cables potencia: 50cm mínimo
- Temperatura operación: -20°C a +60°C

**NFPA 70 (seguridad contra incendios)**

- Cables LSZH (Low Smoke Zero Halogen)
- Clasificación de humo y gases tóxicos
- Distancia mínima de fuentes de calor: 20cm
- Conductos retardantes en zonas de riesgo

**TIA/EIA 568 (cableado estructurado)**

- Máxima distancia: 100m (horizontal)
- Radio de curvatura: 4× diámetro del cable
- Ocupación conducto: máximo 40%
- Crosstalk: -35dB mínimo
- Return Loss: 20dB mínimo @ 100MHz

**ISO/IEC 27001 (seguridad de la información)**

- Cableado segregado si transmite datos sensibles
- Segregación física de redes
- Acceso restringido a puntos de conexión
- Logs de cambios

#### 5.2 Validación en tiempo real

Mientras diseñas, la app muestra un panel de cumplimiento con estados OK / advertencia / error y sugerencias de corrección.

---

### 6. Módulo de exportación a Revit (BIM)

Genera un paquete BIM parametrizado del proyecto (IFC-lite, parámetros compartidos, script Dynamo; `.RVT` nativo requiere worker/add-in).

#### 6.1 Elementos 3D generados

- Cámaras, switches, routers, APs
- Conductos y bandejas
- Cajetines
- Paneles de control
- Cámaras de acceso subterráneas

#### 6.2 Parámetros inteligentes

Cada elemento puede llevar información técnica (resolución, PoE, IP rating, cable, distancia, instalación).

#### 6.3 Vistas y compatibilidad

- Vista por nivel / cableado / equipamiento
- Planos técnicos 2D
- Listas de materiales
- Formatos: paquete BIM, IFC, PDF, glTF (según fase)

---

### 7. Módulo de diagrama técnico auto-generado

Mientras diseñas en el canvas, genera un diagrama técnico profesional:

- Diagrama de conexiones (qué conecta a qué)
- Diagrama de red (topología)
- Especificaciones en cajas
- Rutas de cable etiquetadas
- Leyenda y simbología
- Exporta en PDF, PNG, SVG

---

### 8. Módulo de automatización e integración

Define automatizaciones del tipo «si ocurre X, entonces haz Y» (visión de producto / roadmap para integración con domótica y alertas).

Ejemplos:

```
IF Cámara detecta movimiento
THEN Encender luces de área
AND Enviar alerta al móvil

IF Switch principal se desconecta
THEN Activar switch respaldo
AND Notificar a equipo técnico
```

---

### 9. Módulo de análisis y validación

Detecta errores y problemas en el diseño:

- Puntos ciegos en cobertura CCTV
- Zonas sin cobertura WiFi
- Cables que superan distancia máxima
- PoE insuficiente en switches
- Cajetines sobrecargados
- Fallos de redundancia / SPOF
- Incumplimiento normativo

---

### 10. Módulo de presupuesto dinámico

Calcula presupuesto automático que se actualiza al editar el diseño:

- Costo de equipos (cámaras, switches, APs)
- Costo de cables y conductos
- Costo de instalación estimado
- Margen de distribuidor (configurable)
- Impuestos según país
- Comparación con cotizaciones

---

## Selector de unidades de medida

### Sistema métrico (internacional)

- Distancia: metros (m)
- Profundidad: centímetros (cm)
- Diámetro conducto: milímetros (mm)
- Temperatura: Celsius (°C)
- Peso: kilogramos (kg)

### Sistema imperial (USA, UK)

- Distancia: pies (ft)
- Profundidad: pulgadas (")
- Diámetro conducto: pulgadas (")
- Temperatura: Fahrenheit (°F)
- Peso: libras (lbs)

### Sistema mixto (construcción)

- Distancia: metros (m)
- Profundidad: pulgadas (") — común en construcción USA
- Temperatura: Celsius (°C)

Las conversiones se hacen automáticamente; los cálculos internos usan unidades base y el resultado se muestra en el sistema elegido.

| Sistema métrico | Sistema imperial |
|---|---|
| PVC 50mm | PVC 2" |
| PVC 75mm | PVC 3" |
| PVC 110mm | PVC 4.5" |
| Acero 150mm | Acero 6" |
| Acero 200mm | Acero 8" |
| Hormigón 300mm | Hormigón 12" |

---

## Ventajas de NetVision Pro

| Característica | Beneficio |
|---|---|
| Diseño visual drag-drop | Más rápido que dibujar manualmente |
| Cálculos automáticos | Menos errores matemáticos |
| Validación normativa | Apoyo al cumplimiento de regulaciones |
| Exporta a BIM/Revit | Integración con softwares profesionales |
| BOM automática | Presupuestos precisos al instante |
| Diagrama auto-generado | Menos dependencia de dibujante |
| Detección de errores | Problemas antes de la instalación |
| Canalizaciones | Visualiza y cuantifica ductos enterrados |
| Documentación | Listo para cliente y obra |

---

## Casos de uso

### 1. Centro comercial (vigilancia + WiFi)

Usar: módulos CCTV + Redes + Cableado. Generar: BOM + BIM + diagrama técnico.

### 2. Hospital (crítico + cumplimiento)

Usar: CCTV + normativa ISO 27001 + redundancia. Generar: reporte de cumplimiento + paquete BIM.

### 3. Estadio (proyecto mega)

Usar: CCTV + Redes + Canalizaciones + BIM. Generar: planos constructivos + presupuesto detallado.

### 4. Edificio inteligente (domótica)

Usar: Automatización + Redes + Cableado. Generar: diagrama + especificaciones.

### 5. Instalador técnico (obra pequeña)

Usar: Cableado + Cajetines + Validación rápida. Generar: BOM + presupuesto + diagrama simple.

---

## Flujo típico de un proyecto

1. **Crear proyecto** — nombre, descripción, ubicación, país
2. **Importar plano** — PDF, PNG (DWG/RVT según roadmap)
3. **Diseñar** — cámaras, switches/APs, conexiones; revisión automática
4. **Validar** — cobertura, normas, cajetines/conductos; resolver advertencias
5. **Generar documentos** — BOM, BIM, diagrama, presupuesto, reportes
6. **Compartir con cliente** — presupuesto + especificaciones
7. **Instalar** — compras con BOM, planos en obra, registro de completado

---

## Beneficios por rol

### Diseñadores / ingenieros

- Menos tiempo en diseño y menos errores
- Exportación hacia flujos BIM/Revit
- Validación normativa automática

### Instaladores / técnicos

- BOM clara y exacta
- Planos y especificaciones para obra
- Menos sorpresas en campo

### Gerentes de proyecto

- Presupuesto más preciso
- Reportes automáticos
- Mejor control de cambios

### Clientes

- Documentación profesional
- Presupuesto transparente
- Visualización y especificaciones claras

---

## Conclusión

NetVision Pro concentra en una sola herramienta el diseño visual, los cálculos, la validación normativa, la documentación y el presupuesto para proyectos CCTV, redes, cableado y canalizaciones.

**Resultado:** proyectos más rápidos, precisos y profesionales.

Para el detalle técnico de implementación y límites actuales, consulta [`NETVISION-PRO.md`](./NETVISION-PRO.md).
