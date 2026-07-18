# Manual de usuario: NetVision Pro

Cómo manejar la plataforma paso a paso.

> Complementa el [manual explicativo](./NETVISION-PRO-MANUAL.md) y la [guía de instaladores](./NETVISION-PRO-INSTALLER-GUIDE.md).  
> En la app: [`/nexus/vision/manual/usuario`](/nexus/vision/manual/usuario).  
> Estado técnico: [`NETVISION-PRO.md`](./NETVISION-PRO.md).

**Nota de interfaz:** Los nombres de botones de este manual describen el flujo completo del producto. En la app actual: **Cargar PDF / imagen**, **+ Cámara / + Switch / + AP / + NVR / + Injector**, pestañas Plano · Diagrama · Red · Cable · Sub · Norm · BIM, capas con **?**, y **Manual** en la cabecera. El diseño se guarda en `sessionStorage` del navegador.

---

## Índice

1. [Primeros pasos](#primeros-pasos)
2. [Configurar preferencias](#configurar-preferencias)
3. [Crear un proyecto](#crear-un-proyecto)
4. [Importar plano](#importar-plano)
5. [Diseñar CCTV](#diseñar-cctv)
6. [Diseñar red](#diseñar-red)
7. [Conectar componentes](#conectar-componentes)
8. [Validar proyecto](#validar-proyecto)
9. [Exportar documentos](#exportar-documentos)
10. [Casos prácticos](#casos-prácticos)
11. [Solución de problemas](#solución-de-problemas)
12. [Atajos de teclado](#atajos-de-teclado)

---

## Primeros pasos

### Pantalla principal

Cuando abres NetVision Pro, verás algo equivalente a:

```
┌─────────────────────────────────────────────────────────┐
│ NetVision Pro  │ [Manual] [Cargar PDF / imagen] […]     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  BIENVENIDO / ZONA DE PLANO                              │
│  Diseña sistemas CCTV, redes y cableado.                 │
│                                                          │
│  [Cargar PDF / imagen]                                   │
│  Luego: + Cámara, + Switch, + AP, validar, exportar      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Configurar preferencias

### Paso 1: Normas

Pestaña **Norm**:

- País / región
- Perfiles: NEC, IEC, NFPA, TIA/EIA, ISO27001 (según país)
- La validación se actualiza al editar el diseño

### Paso 2: Sistema de medidas (visión de producto)

```
┌──────────────────────────────────────────────┐
│ SISTEMA DE MEDIDAS                           │
├──────────────────────────────────────────────┤
│                                              │
│ ⦿ Métrico (Internacional)                   │
│   ├─ Distancia: Metros (m)                  │
│   ├─ Profundidad: Centímetros (cm)          │
│   ├─ Conductos: Milímetros (mm)             │
│   ├─ Temperatura: Celsius (°C)              │
│   └─ Peso: Kilogramos (kg)                  │
│                                              │
│ ○ Imperial (USA, UK)                        │
│   ├─ Distancia: Pies (ft)                   │
│   ├─ Profundidad: Pulgadas (")              │
│   ├─ Conductos: Pulgadas (")                │
│   ├─ Temperatura: Fahrenheit (°F)           │
│   └─ Peso: Libras (lbs)                     │
│                                              │
│ ○ Mixto (Construcción USA)                  │
│   ├─ Distancia: Metros (m)                  │
│   ├─ Profundidad: Pulgadas (")              │
│   └─ Temperatura: Celsius (°C)              │
└──────────────────────────────────────────────┘
```

### Paso 3: Divisas y precios

```
├─ NORMATIVAS PREDETERMINADAS
│  ├─ País: [Selecciona tu país ▼]
│  └─ Normas del perfil del país
│
└─ DIVISAS Y PRECIOS (BOM / presupuesto)
   ├─ Divisa: USD / local
   └─ Margen distribuidor: p. ej. 15%
```

---

## Crear un proyecto

### Paso 1: Abrir NetVision

Ve a Nexus → **NetVision Pro** (`/nexus/vision`).

### Paso 2: Datos del proyecto

Define (en UI o en tus notas de obra):

```
┌─────────────────────────────────────────────┐
│ CREAR / DEFINIR PROYECTO                    │
├─────────────────────────────────────────────┤
│ Nombre: Centro Comercial Plaza Mayor        │
│ Descripción: CCTV + WiFi ~500m², 10 cámaras │
│ País: (pestaña Norm)                        │
│ Tipo: CCTV + Red + Cableado (Completo)      │
│   u otras pestañas: Solo Sub, Norm, BIM…    │
│ Cliente (opcional): Juan Pérez              │
└─────────────────────────────────────────────┘
```

Hoy la sesión del diseño vive en el navegador; usa **Nuevo plano** para empezar de cero.

### Paso 3: Layout de trabajo

```
┌──────────────────────────────────────────────────────┐
│ NetVision Pro │ Proyecto en sesión                   │
├──────────────────────────────────────────────────────┤
│ Canvas central (plano)     │ Paneles laterales       │
│ Capas / herramientas       │ Equipos, BOM, Validación│
└──────────────────────────────────────────────────────┘
```

---

## Importar plano

### Paso 1: Preparar el plano

- PDF (arquitectónico)
- PNG / JPG (foto de plano)
- DWG / RVT: roadmap (ver documentación técnica)

### Paso 2: Botón importar

Cabecera → **Cargar PDF / imagen** (o zona de carga del canvas).

### Paso 3: Seleccionar archivo

Ejemplo: `Centro_Comercial.pdf` → Abrir.

### Paso 4: Calibración (importante)

El plano se carga pero necesita escala real:

```
┌─────────────────────────────────────────┐
│ CALIBRAR PLANO                          │
├─────────────────────────────────────────┤
│ Haz clic en DOS PUNTOS cuya distancia   │
│ real conozcas (ej. entre dos pilares).  │
│                                         │
│ Punto 1 → Punto 2                       │
│ Distancia real: [10 metros]             │
│ [Calibrar]                              │
└─────────────────────────────────────────┘
```

1. Identifica dos puntos (ej. esquinas de la sala)
2. Mide la distancia real (10 m)
3. Clic en Punto 1 → luego Punto 2
4. Ingresa la distancia y confirma

**Resultado:** el plano tiene escala real para FOV, WiFi y cables.

---

## Diseñar CCTV

### Paso 1: Librería / catálogo de cámaras

Usa **[+ Cámara]** y el selector de marca/modelo:

```
├─ CCTV
│  ├─ Hikvision
│  ├─ Axis
│  ├─ Uniview
│  ├─ Dahua
│  ├─ Sony
│  └─ (catálogo ampliable: Ezviz, Aqara, …)
```

### Paso 2: Seleccionar cámara

Ejemplo: **Hikvision → DS-2CD2647FWD**

```
DS-2CD2647FWD
├─ Resolución: 4MP
├─ PoE: ~7.8W
├─ FOV / alcance: según catálogo
└─ IP Rating: según ficha
```

### Paso 3: Colocar en el canvas

No crees cámaras con un clic vacío en el plano. Tras **+ Cámara**, **arrastra el pin** a la ubicación de instalación.

### Paso 4: Ver cobertura

Activa la capa **Visión**. Verás el cono/espectro de cobertura. Ajusta:

- Orientación (yaw)
- Apertura FOV°
- Alcance (m)
- Asas en el plano / sliders

Consulta **?** en la barra de capas para Visión / WiFi / Sonido / Enlaces / Rutas / Sub / Noche.

### Paso 5: Agregar más cámaras

Repite **+ Cámara**. Renombra mentalmente CAM-001, CAM-002, …

### Paso 6: Validar puntos ciegos

Usa el panel de validación / **Calcular cobertura** cuando esté disponible:

```
ANÁLISIS DE COBERTURA
═════════════════════════════════════
✅ Cobertura general: 98%
⚠️  Puntos ciegos / zonas débiles
❌ Redundancia en zona crítica (si aplica)

RECOMENDACIONES:
→ Agregar o reposicionar cámaras
→ Revisar muros (drywall/bloque cortan FOV)
```

**Muros:** pestaña **Muros** — dos toques en el plano (drywall, bloque, vidrio, ventana).

---

## Diseñar red

### Paso 1: Access Point WiFi

**[+ AP]** → modelo → arrastra al plano (centro de la zona a cubrir).

La capa **WiFi** muestra cobertura y atenuación por materiales.

```
ANÁLISIS DE POSICIÓN AP (ejemplo)
═════════════════════════════════════
Cobertura teórica vs real (paredes)
Intensidad por distancia
⚠️  Zonas sin cobertura → agregar AP
```

### Paso 2: Switch principal

**[+ Switch]** → coloca en sala técnica.

```
Ejemplo switch PoE
├─ Puertos Gigabit
├─ Presupuesto PoE (W)
└─ Uplink hacia router/firewall
```

### Paso 3: NVR e injectors

- **[+ NVR]** — grabación
- **[+ Injector]** — PoE auxiliar si el switch se queda corto

### Paso 4: Validar capacidad de red

```
VALIDACIÓN DE CAPACIDAD (ejemplo)
═════════════════════════════════════
Ancho de banda cámaras + APs + margen
PoE usado vs disponible
✅ Bien dimensionado / ⚠️ saturación
```

---

## Conectar componentes

### Paso 1: Cámaras → switch

En pestaña **Cable** / herramienta de rutas:

1. Origen: CAM-001
2. Destino: Switch (puerto)
3. Suelta / confirma el enlace

```
[CAM-001] ── CAT6A 87m ──► [SWITCH-A]
```

### Paso 2: Cálculo automático

```
CÁLCULO DE CONEXIÓN
═════════════════════════════════════
Distancia: según escala del plano
Cable: CAT6 / CAT6A / Fibra (>100m)
PoE: consumo vs disponible
Cajetines / ocupación conducto (≤40%)
Validación: NEC / TIA según pestaña Norm
```

### Paso 3: Múltiples cámaras

Repite. La app suma PoE, actualiza cajetines y BOM.

### Paso 4: APs y uplink

- AP → Switch (CAT6A PoE)
- Switch → Router (CAT6A o fibra)

---

## Validar proyecto

### Opción 1: Tiempo real

Panel de validación / Norm mientras diseñas:

```
┌──────────────────────────────────────────┐
│ VALIDACIÓN EN TIEMPO REAL                │
├──────────────────────────────────────────┤
│ ✅ Cobertura CCTV                        │
│ ✅ / ⚠️ Cobertura WiFi                   │
│ ⚠️  Cajetín casi lleno                   │
│ ✅ Cumplimiento normativo (perfil país)  │
│ ⚠️  Cable >100m                          │
│ ✅ PoE restante en switch                │
└──────────────────────────────────────────┘
```

### Opción 2: Validación completa

Ejecuta la validación completa desde el panel correspondiente.

```
REPORTE DE VALIDACIÓN (estructura)
═════════════════════════════════════
Resumen: errores / advertencias
CCTV · Red · Cableado · Normativa · Presupuesto
Acciones recomendadas
```

### Resolver errores

Ejemplo cable a 105 m:

1. Cambiar a fibra
2. Agregar repetidor / injector
3. Reubicar switch

Revalida hasta estado aceptable.

---

## Exportar documentos

### BOM (lista de materiales)

Panel BOM → exportar Excel/CSV (según opciones de la UI). Incluye cantidades, precios y totales.

### BIM / Revit

Pestaña **BIM** → paquete (JSON, IFC-lite, parámetros compartidos, script Dynamo).  
`.RVT` nativo requiere worker/add-in (no en el navegador).

### Diagrama técnico

Vista **Diagrama** → PNG / SVG / PDF.

### Cumplimiento normativo

**Norm** → matriz CSV / PDF.

### Plano

Cabecera → **PNG**.

### Presupuesto / reporte largo

BOM + validación + exports anteriores. Reportes ejecutivos extendidos: según roadmap.

---

## Casos prácticos

### Caso 1: Centro comercial 500 m²

1. Nombre: Centro Comercial Plaza Mayor · tipo completo
2. Importar PDF · calibrar 20 m entre pilares
3. ~10 cámaras (pasillos, entradas, escaleras, cajas)
4. 2 AP + 1 switch PoE + router/NVR según diseño
5. Conectar todo en Cable · validar · exportar BOM + diagrama + PNG + BIM

### Caso 2: Hospital (crítico)

1. **Norm** → incluir ISO27001
2. Segregar redes (CCTV vs datos)
3. Redundancia en zonas críticas
4. Exportar reporte / matriz de cumplimiento

### Caso 3: Canalizaciones subterráneas

1. Pestaña **Sub**
2. Inicio → fin · zona peatonal / vehicular
3. Revisar tubería, profundidad, cámaras de acceso, costos
4. Exportar datos / incluir en BOM

---

## Solución de problemas

### El plano no está bien calibrado

Vuelve a indicar dos puntos y la distancia real. Sin escala, metros y FOV no son fiables.

### Cobertura WiFi insuficiente

Capa **WiFi** → mover AP, agregar **+ AP**, o revisar muros que atenúan.

### Switch sin capacidad PoE

```
❌ PoE excedido
→ Switch con más presupuesto PoE
→ + Injector
→ Redistribuir cámaras
```

### La cámara no aparece al hacer clic en el plano

Usa **+ Cámara**. El clic en plano sirve para calibrar o dibujar muros (2 puntos).

### No encuentro la documentación

- **Manual** en cabecera → explicativo
- `/nexus/vision/manual/usuario` → este manual
- `docs/NETVISION-PRO.md` → implementación

---

## Atajos de teclado

```
Ctrl/Cmd+S     Guardar / exportar según UI
Ctrl/Cmd+Z     Deshacer (si el canvas lo soporta)
Del            Eliminar componente seleccionado
+/- / rueda    Zoom
Espacio+drag   Mover canvas (si está habilitado)
```

Algunos atajos listados en visiones de producto (Ctrl+V validar, Ctrl+E exportar) pueden no estar cableados aún.

---

## Soporte y ayuda

```
├─ ? → Guía de capas en el plano
├─ Manual → Manual explicativo
├─ /nexus/vision/manual/usuario → Este manual
└─ docs/NETVISION-PRO.md → Detalle técnico
```

---

**Fin del manual de usuario.**  
¡Listo para diseñar proyectos profesionales con NetVision Pro!
