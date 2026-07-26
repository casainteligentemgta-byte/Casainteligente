# Worker Tours 3D (`obra-tours-worker`)

Servicio HTTP que recibe jobs de reconstrucción desde la app Casa Inteligente.

## Contrato

- `GET /health` — estado del worker
- `POST /v1/reconstruct` — encola job (responde `202` y procesa en background)

Body (igual que documenta `docs/OBRA-TOURS-3D.md`):

```json
{
  "job_id": "uuid",
  "proyecto_id": "uuid",
  "video_url": "https://...",
  "fuente_captura": "dron",
  "calidad": "rapida",
  "callback_url": "https://app/api/proyectos/tours/worker-callback",
  "callback_token": "..."
}
```

Auth opcional hacia el worker: `Authorization: Bearer $OBRA_TOURS_WORKER_TOKEN`.

Callback hacia la app: header `X-Obra-Tours-Token: <callback_token>`.

## Pipelines

| `OBRA_TOURS_PIPELINE` | Comportamiento |
|-----------------------|----------------|
| `frames_glb` (default) | Descarga video → frames con ffmpeg (si hay) → genera GLB → sube a Supabase Storage → callback `modelo_listo` |
| `colmap` | Usa COLMAP si el binario está en PATH; si no, fallback a `frames_glb` |

> `frames_glb` produce un modelo 3D **navegable y real en el flujo** (archivo `.glb` en Storage). No es fotogrametría densa; para eso despliega una imagen CUDA con COLMAP y `OBRA_TOURS_PIPELINE=colmap`.

## Variables de entorno (worker)

```bash
PORT=8787
OBRA_TOURS_WORKER_TOKEN=cambia-esto
OBRA_TOURS_PIPELINE=frames_glb
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OBRA_TOURS_STORAGE_BUCKET=ci-proyectos-media
# OBRA_TOURS_MAX_VIDEO_MB=512
```

## Local

```bash
cd workers/obra-tours
npm install
cp ../../.env.example .env.local   # o exporta las vars
npm run dev
```

Desde la raíz del monorepo:

```bash
npm run obra-tours:worker
```

En la app (Vercel / `.env.local`):

```bash
OBRA_TOURS_WORKER_URL=http://127.0.0.1:8787
OBRA_TOURS_WORKER_TOKEN=cambia-esto
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

## Docker

```bash
docker build -t obra-tours-worker ./workers/obra-tours
docker run --rm -p 8787:8787 \
  -e OBRA_TOURS_WORKER_TOKEN=cambia-esto \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  obra-tours-worker
```

El host de la app debe poder alcanzar `OBRA_TOURS_WORKER_URL`, y el worker debe poder alcanzar `callback_url` (URL pública de la app).
