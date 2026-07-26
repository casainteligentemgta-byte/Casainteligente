# Tours 3D de obra (opción B)

Video (celular/dron) → reconstrucción 3D → **modo piloto (joystick)** o **export MP4 para DJI Goggles**.

## Ruta UI

`/proyectos/modulo/[id]/control-obra/tours`

## Variables de entorno (app)

| Variable | Uso |
|----------|-----|
| `OBRA_TOURS_WORKER_URL` | Base del worker (`POST /v1/reconstruct`, `GET /health`) |
| `OBRA_TOURS_WORKER_TOKEN` | Bearer opcional hacia el worker |
| `ALLOW_OBRA_TOURS_SIMULAR=1` | Permite simular modelo sin worker |
| `NEXT_PUBLIC_APP_URL` | Origen para `callback_url` del worker |

Sin worker, el job queda en `encolado` con `worker_payload.stub=true` y la UI ofrece **Simular modelo**.

Diagnóstico: `GET /api/proyectos/tours/worker-health`.

## Worker real

Código: `workers/obra-tours/` (ver su README).

1. Levanta el worker (`npm run obra-tours:worker` o Docker).
2. Configura en la app `OBRA_TOURS_WORKER_URL` + token.
3. El worker necesita Supabase (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) para subir el `.glb`.
4. El worker debe poder llamar al callback público de la app.

Pipeline por defecto: `frames_glb` (ffmpeg + GLB + Storage). Opcional: `OBRA_TOURS_PIPELINE=colmap` en máquina con COLMAP/CUDA.

## Contrato worker

`POST {OBRA_TOURS_WORKER_URL}/v1/reconstruct` → `202 Accepted`

```json
{
  "job_id": "uuid",
  "proyecto_id": "uuid",
  "video_url": "https://...",
  "fuente_captura": "dron|celular",
  "calidad": "rapida|detallada",
  "callback_url": "https://app/api/proyectos/tours/worker-callback",
  "callback_token": "..."
}
```

Callback: `POST /api/proyectos/tours/worker-callback` con header `X-Obra-Tours-Token`.

Estados de callback: `procesando` | `modelo_listo` | `error`.

Al aceptar el job, la app marca el registro como `procesando` (progreso ~5%) hasta que el worker reporta avances.

## DJI Goggles

Export recomendado: MP4 H.264, layout **HSBS**. microSD → Álbum → modo 3D HSBS.

## Migración

`296_ci_obra_tours_video_reconstruccion.sql` → tablas `ci_obra_tour_jobs`, `ci_obra_tours`.
(En main, `295` quedó para Metron; Tours se renumeró a `296`. Si ya aplicaste el SQL de Tours como 295 en el Editor, no hace falta reaplicarlo.)
