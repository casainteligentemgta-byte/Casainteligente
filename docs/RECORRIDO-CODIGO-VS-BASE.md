# Recorrido del código contra la base (11-oct-2026)

Se compararon todas las consultas del código con las tablas y columnas que existen de
verdad en la base de producción: 2.080 consultas en 1.764 archivos, 6.536 columnas.
162 consultas arman sus columnas al vuelo y no se pudieron revisar así.

No es una prueba en pantalla: detecta lo que falla porque el código pide algo que la base
no tiene, o porque quien tiene sesión no puede leerlo. No detecta errores de la interfaz.

## Arreglado en este recorrido

| Qué | Efecto |
| --- | --- |
| El nombre por chat del bot pedía una columna inexistente y lanzaba error | En las obras sin nómina cargada no se podía armar la lista de aprobadores de una procura |
| Etiquetas del chat espejo y del registro del bot | Salían sin cargo ni nombre de material |
| Etiqueta de obra del auditor de contabilidad | Salía «Obra 171694ed» en vez del nombre con su código |
| Abonos en bolívares en Finanzas de la obra | La lista salía siempre vacía |
| Código del material en compras desde ingreso manual | Quedaba en blanco |
| Contratos de trabajo: faltaban `created_at`, aceptación y ruta del PDF (migración 347) | Fallaban firmas pendientes, firma física, descarga y el conteo del informe semanal |

## Módulos cuyo código pide cosas que la base no tiene

La causa común: migraciones que están en el repositorio y nunca se ejecutaron en
producción, o pantallas hechas para un esquema anterior. Hay que decidir, módulo por
módulo, si se instala o se retira.

| Módulo | Qué falta | Qué pasa hoy |
| --- | --- | --- |
| Cobros de presupuestos (abonos y cuotas) | Tablas `budget_abonos`, `budget_cuotas`; columnas `budgets.monto_pagado`, `saldo` (migración 318) | El cuadro de cobros avisa que falta la migración |
| Rentabilidad (`/operaciones/rentabilidad`) | Vista `vw_analisis_rentabilidad` | Pantalla vacía |
| Contratación (`/rrhh/contratacion`) | Tabla `ci_contratos` | Error al cargar |
| Notificaciones de la obra | `ci_notificaciones.leida` y `empleado_id` (la tabla tiene `leido`) | El cuadro de avisos da error |
| Flota: manuales con asistente y documentos de conductores | `ci_flota_manuales`, `ci_flota_manual_chunks`, `ci_flota_conductor_documentos` (migración 313) | Esas dos partes no funcionan |
| Maquinaria entre empresas | Columnas de `ci_maquinaria_maestro` y `ci_maquinaria_control_horas`; además sin permiso de lectura con sesión | No carga |
| Evaluaciones de prospectos (`/evaluaciones`, `/test/[token]`, `/onboarding/[token]`) | `ci_prospectos`, `ci_evaluaciones`; `evaluaciones` tiene otras columnas | No funciona |
| Minutas de reunión (Pheme) | `ci_pheme_reuniones` | No guarda la reunión |
| Base de conocimiento legal | `ci_legal_knowledge` | La carga de documentos falla |
| Valuaciones | `ci_obra_nomina_pagos` | El cálculo falla |
| Certificado técnico en PDF | `tb_detalle_tecnico`; `tb_proyectos` sin permiso de lectura | No se genera |
| Contrato de administración delegada | `contracts.pdf_url` (la tabla tiene `pdf_storage_url`) | No guarda el enlace del PDF |
| Puntaje del cliente | `budgets.total`, `grand_total`; tabla `empresas_deprecated` | El puntaje ignora los presupuestos |
| Alias de materiales (aprende nombres de facturas) | `ci_material_aliases` (migración 242) | Apagado en silencio |
| Selector de personal y embudo de reclutamiento | `project_assignments.end_date` | Listas vacías |

## Tolerado por el propio código (prueba una columna y, si falla, usa otra)

`ci_usuarios_roles.usuario_id`, `customers.updated_at` y `nombre_comercial`,
`ci_proyectos.obra_*`, `ci_entidades.nombre_legal`, `ci_empleados.oficio`,
`products.ubicacion`, `ci_procura_factura_vinculos`. Funcionan, pero cada intento fallido
es una consulta perdida y esconde errores reales.

## Lectura con sesión

De las tablas que las pantallas leen desde el navegador, solo cuatro no devuelven nada a
quien tiene sesión: `ci_maquinaria_maestro`, `ci_maquinaria_control_horas`, `evaluaciones`
y `tb_proyectos`. Ninguna pertenece a inventario, compras, contabilidad, presupuestos,
proyectos ni RRHH: los cierres de las migraciones 342, 345 y 346 no dejaron sin acceso al
personal en esos módulos.
