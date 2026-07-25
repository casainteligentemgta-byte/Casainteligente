# Tours 3D de obra (opción B)

Video (celular/dron) → reconstrucción 3D → **modo piloto (joystick)** o **export MP4 para DJI Goggles**.

## Ruta UI

`/proyectos/modulo/[id]/control-obra/tours`

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `OBRA_TOURS_WORKER_URL` | Base del worker GPU (`POST /v1/reconstruct`) |
| `OBRA_TOURS_WORKER_TOKEN` | Bearer opcional hacia el worker |
| `ALLOW_OBRA_TOURS_SIMULAR=1` | Permite simular modelo sin worker |
| `NEXT_PUBLIC_APP_URL` | Origen para `callback_url` del worker |

Sin worker, el job queda en `encolado` con `worker_payload.stub=true` y la UI ofrece **Simular modelo**.

## Contrato worker

`POST {OBRA_TOURS_WORKER_URL}/v1/reconstruct`

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

## DJI Goggles

Export recomendado: MP4 H.264, layout **HSBS**. microSD → Álbum → modo 3D HSBS.

## Migración

`295_ci_obra_tours_video_reconstruccion.sql` → tablas `ci_obra_tour_jobs`, `ci_obra_tours`.
