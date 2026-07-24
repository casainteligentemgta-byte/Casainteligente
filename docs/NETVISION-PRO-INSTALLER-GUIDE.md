# Guía rápida técnica para instaladores

**NetVision Pro — Referencia de bolsillo**

> Tablas y reglas de campo. Complementa el [manual de usuario](./NETVISION-PRO-USER-MANUAL.md) y el [manual explicativo](./NETVISION-PRO-MANUAL.md).  
> En la app: [`/nexus/vision/manual/instaladores`](/nexus/vision/manual/instaladores).  
> Estado técnico: [`NETVISION-PRO.md`](./NETVISION-PRO.md).

**Versión doc:** 2.0 · Referencia de ingeniería (no sustituye código local ni dictamen legal).

---

## Tabla de conversión rápida

### Distancia

| Métrico | Imperial | Conversión |
|---------|----------|-----------|
| 1 m | 3.28 ft | Metro a pies |
| 10 m | 32.8 ft | |
| 50 m | 164 ft | |
| 87 m | 285 ft | Típico CCTV |
| 100 m | 328 ft | Máximo PoE |
| 150 m | 492 ft | Larga distancia |
| 1 km | 0.62 millas | |

### Profundidad

| Métrico | Imperial | Conversión |
|---------|----------|-----------|
| 10 cm | 3.94" | Muy superficial |
| 30 cm | 11.8" | Mínimo peatonal |
| 60 cm | 23.6" | Zona vehicular |
| 80 cm | 31.5" | Cruce carretera |
| 120 cm | 47.2" | Bajo ferrocarril |

### Diámetro conductos / tuberías

| Métrico | Imperial | Aplicación |
|---------|----------|-----------|
| 16 mm | 0.63" | 1-2 cables CAT6 |
| 20 mm | 0.79" | 2-4 cables CAT6 |
| 25 mm | 1.00" | 4-6 cables CAT6 |
| 32 mm | 1.26" | 6-8 cables CAT6 |
| 40 mm | 1.57" | 8-12 cables CAT6 |
| 50 mm | 2.00" | 12-15 cables |
| 75 mm | 3.00" | 15-25 cables |
| 110 mm | 4.50" | 25-40 cables |
| 150 mm | 6.00" | >40 cables |
| 200 mm | 8.00" | Proyectos mega |

### Temperatura

| Celsius | Fahrenheit |
|---------|-----------|
| -30°C | -22°F |
| 0°C | 32°F |
| 20°C | 68°F |
| 25°C | 77°F (ambiente) |
| 45°C | 113°F |
| 60°C | 140°F (máximo típico) |

---

## Especificaciones de cables

### Cables Ethernet estándar

```
CAT5E (Legacy)
├─ Velocidad: 100 Mbps
├─ Distancia máxima: 100m
├─ Diámetro: ~5.5mm
├─ Costo ref.: ~$0.08/m
└─ Uso: Sistemas antiguos

CAT6 (CCTV estándar)
├─ Velocidad: 1 Gbps
├─ Distancia máxima: 100m con PoE
├─ Diámetro: ~6.0mm
├─ Costo ref.: ~$0.12/m
├─ PoE: hasta presupuesto del switch / inyectores
└─ Uso: mayoría de proyectos CCTV

CAT6A (4K / HD)
├─ Velocidad: 10 Gbps
├─ Distancia máxima: 100m
├─ Diámetro: ~7.0mm
├─ Costo ref.: ~$0.15/m
└─ Uso: Cámaras 4MP+, proyectos premium

FIBRA MONOMODO
├─ Velocidad: hasta 100 Gbps (según óptica)
├─ Distancia: km (según transceiver)
├─ Diámetro: ~8.5mm (cable)
├─ Costo ref.: ~$0.50/m
├─ Conectores: SC, LC, ST, MTP
└─ Uso: >100m, EMI, backbone

FIBRA MULTIMODO
├─ Velocidad: hasta 40 Gbps (según tipo)
├─ Distancia típica: cientos de metros
├─ Costo ref.: ~$0.35/m
└─ Uso: data centers, tramos cortos
```

### Especificaciones de PoE

```
PoE 802.3af
├─ Voltaje: 44-57V
├─ Corriente máx.: ~350mA
└─ Potencia máx.: 15.4W

PoE+ 802.3at
├─ Voltaje: 44-57V
├─ Corriente máx.: ~600mA
└─ Potencia máx.: 30W

PoE++ 802.3bt
├─ Tipo 3: ~60W
└─ Tipo 4: ~90-100W  ← PTZ / alta demanda
```

### Pérdida de señal (referencia)

| Cable | Distancia | Pérdida | Status |
|-------|-----------|--------|--------|
| CAT6 | 50m | ~1.5dB | Excelente |
| CAT6 | 87m | ~2.1dB | Bueno |
| CAT6 | 100m | ~2.4dB | Límite |
| CAT6 | 110m | ~2.6dB | Fuera de espec. Ethernet |
| CAT6A | 100m | ~1.8dB | Excelente |
| Fibra | 100m | <0.5dB | Óptimo |

---

## Normas y regulaciones

Asistencia de ingeniería; validar con el código aplicable en obra.

### NEC (USA)

```
✓ Máxima distancia canal horizontal Ethernet: 100m sin repetidor/media converter
✓ Separación alto voltaje: 30cm mínimo (según aplicación)
✓ Cable listado (UL) donde se exija
✓ No exceder tensión de tracción del fabricante
✓ Grounding en ducto metálico según código
✓ Radio de curvatura: ~4× diámetro del cable (UTP)
```

### TIA/EIA 568

```
✓ Canal horizontal: 100m máx. (90m permanente + patch)
✓ Radio de curvatura: ~4× diámetro
✓ Ocupación conducto: máximo ~40%
✓ Crosstalk / Return Loss según categoría
✓ Impedancia: 100Ω ±15% (CAT6/6A)
```

### NFPA 70 / fuego

```
✓ LSZH / plenum / riser según zona
✓ Distancia a fuentes de calor según código
✓ Conductos / métodos de cableado en áreas críticas
```

### IEC (Europa / internacional)

```
✓ Separación de potencia según IEC / local
✓ Impedancia coaxial típica 75Ω ±5% (vídeo analógico)
✓ Temperatura operación típica equipos: -20°C a +60°C (ficha)
```

En NetVision: pestaña **Norm** + país/región.

---

## Especificaciones cámaras IP comunes

Valores de referencia de fichas; confirmar en catálogo NetVision / fabricante.

### Hikvision DS-2CD2647FWD (4MP domo) — ejemplo

```
Resolución              4MP (2688×1520)
Tipo                    Domo
Ángulo horiz. típico    ~106° (lente ancha)
PoE típico              ~7.8W
IP Rating               IP67 (según modelo)
Rango temperatura       -30°C a +60°C (según ficha)
```

### Hikvision DS-2CD2143G0-I (4MP bullet) — ejemplo

```
Resolución              4MP
Tipo                    Bullet exterior
PoE típico              ~6.5W
IR                      ~30m
IP Rating               IP67
```

### Axis M3044-WV (3MP domo) — ejemplo

```
Resolución              3MP
PoE típico              ~9.5W
Rango temperatura       -40°C a +60°C (según ficha)
IP Rating               IP67
```

Usa **+ Cámara** y el selector de marca/modelo en NetVision para datos del catálogo cargado.

---

## Consumo PoE por dispositivo

### Cámaras IP

| Dispositivo | PoE típico | PoE máx. (orden) |
|------------|------------|------------------|
| 2MP básica | 5W | 10W |
| 4MP Hikvision | 6-8W | 15-20W |
| 4MP Axis | 8-10W | 20W |
| 8MP (UHD) | 15W | 30W |
| PTZ motorizada | 20W | 50W |

### Access Points WiFi

| Modelo | PoE típico | PoE máx. (orden) |
|--------|------------|------------------|
| UniFi 6 Pro | 12W | 25W |
| TP-Link EAP670 | 10W | 20W |
| Cisco Meraki MR46 | 11W | 22W |

### Otros

| Dispositivo | PoE típico | PoE máx. (orden) |
|------------|------------|------------------|
| Teléfono IP | 6-8W | 15W |
| Control de acceso | 8W | 20W |
| Sensor IoT | 2-5W | 10W |

---

## Capacidad de switches PoE

Ejemplos de mercado (verificar ficha exacta):

```
Ubiquiti ES-24 (familia PoE)
├─ Puertos: 24 Gigabit
├─ Presupuesto PoE: según SKU (ej. ~96W–500W)
├─ Por puerto: típicamente 30W (at) / más en bt
└─ Cámaras 4MP: presupuesto_total ÷ ~8W (con margen)

Ubiquiti ES-48 PoE
├─ Puertos: 48
├─ Presupuesto alto (según modelo)
└─ Escala para proyectos grandes

TP-Link TL-SG3xxx PoE
├─ 24/48 puertos
├─ Presupuestos ~250W–1200W según modelo
└─ Revisar PoE por puerto (30W / 95W)
```

En NetVision: **+ Switch** y panel de validación PoE.

---

## Cálculo rápido de cajetines

### Regla: ocupación máxima ~40%

```
Cajetín 16mm:
└─ ~4× CAT6 (orientativo)

Cajetín 20mm:
└─ ~8× CAT6

Cajetín 25mm:
└─ ~12× CAT6

Ducto 40×40mm:
└─ ~30× CAT6 (orientativo)
```

Usa el módulo de cajetines / cableado de NetVision para el conteo del proyecto.

---

## Profundidad canalizaciones subterráneas

### Mínimos orientativos por zona

```
Zona peatonal:          30cm (12")
Zona vehicular:         60cm (24")
Cruce de carretera:     80cm (31.5")
Bajo ferrocarril:       120cm (47.2")
Bajo edificios / piso:  40-60cm (según proyecto)
```

Validar siempre con normativa local / proyecto.

### Separación entre servicios

```
Datos vs alto voltaje:  separación horizontal/vertical según código
                        (referencia frecuente: decenas de cm)
Agua vs eléctricos:     no compartir conducto; separación mínima proyecto
Gas vs cables:          separación crítica; nunca mismo conducto
```

Pestaña **Sub** en NetVision.

---

## Cálculo de caída de voltaje PoE

### Fórmula (simplificada)

```
Caída ≈ I × R_loop
R_loop ≈ 2 × (Ω/m) × distancia

Ω/m CAT6 (orden):  ~0.10 Ω/m por conductor
Ω/m CAT6A (orden): ~0.08 Ω/m por conductor
```

### Ejemplo

```
Cámara 7.8W @ 87m CAT6, Vsupply 50V
I ≈ 7.8 / 50 = 0.156 A
R_loop ≈ 2 × 87 × 0.1018 ≈ 17.7 Ω
Caída ≈ 0.156 × 17.7 ≈ 2.8 V (orden de magnitud)
V en cámara ≈ 50 − caída  → debe quedar > ~44V (rango PoE)
```

### Tabla rápida de límites (orientativa)

| Distancia | CAT6 4MP | CAT6A 4MP | Fibra (+media) |
|-----------|----------|----------|----------------|
| 50m | OK | OK | OK |
| 87m | OK | OK | OK |
| 100m | Límite | OK | OK |
| 110m | Fallo Ethernet | Límite | OK |
| 150m | Fallo | Fallo cobre | OK |

---

## Herramientas necesarias

### Cableado

```
Básico:
├─ Crimpadora RJ45
├─ Tester Ethernet
├─ Trazador / toner
├─ Cinta métrica
└─ Cortador de cable

Profesional:
├─ Crimpadora / terminación industrial
├─ Tester con PoE
├─ Certificador de categoría (si el contrato lo exige)
└─ Documentación (NetVision BOM / diagrama)
```

### Excavación

```
Pequeño: pico, pala, nivel, tramos de tubería
Mediano: mini-retro, compactadora
Grande: excavadora, alineación, compactación mecánica
```

---

## Errores comunes y soluciones

### Cable supera 100 m

```
❌ CAT6/6A a >100m
✅ Fibra + media converters / SFP
✅ Repetidor / switch intermedio
✅ Reubicar switch
```

### Switch sin PoE

```
❌ Suma de W de cámaras ≥ presupuesto exacto (sin margen)
✅ Switch con más W
✅ Segundo switch / injector (+ Injector en NetVision)
✅ Redistribuir cargas
```

### Cajetín sobrecargado

```
❌ Más cables que capacidad @ 40%
✅ Cajetín mayor / dividir / conducto / otra ruta
```

### Ocupación conducto >40%

```
❌ Conducto pequeño para el conteo
✅ Diámetro mayor / 2 conductos / fibra / bandeja
```

---

## Presupuesto rápido (órdenes de magnitud)

### Por cámara (material + mano de obra)

```
Simple (~10m):     ~$55
Normal (~87m):     ~$150
Compleja (150m + subterránea): ~$925+
```

Precios de mercado variables por país; usa BOM de NetVision con tus tarifas.

### Margen típico sobre material

```
Instalador individual:  +40–50%
Empresa pequeña:        +35–40%
Empresa grande:         +25–35%
Distribuidor:           +15–20%
```

---

## Ayuda en NetVision

```
├─ Manual (cabecera) → Explicativo / Usuario / Instaladores
├─ ? en capas del plano → guía de capas
├─ Pestaña Norm → cumplimiento
├─ Validación / BOM → errores y materiales
└─ docs/NETVISION-PRO.md → límites técnicos
```

---

**Fin de la guía rápida.** Llévala en obra junto al BOM y el diagrama exportados desde NetVision Pro.
