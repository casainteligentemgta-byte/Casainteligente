# Configurar Vercel

Sigue estos pasos para tener la app Casa Inteligente publicada en Vercel.

## Antes de empezar

- Tener el proyecto subido a **GitHub** (si no: crea un repo y haz `git push`).
- Tener a mano **Supabase**: Project URL y **anon public** key (Project Settings → API).

---

## 1. Entrar en Vercel

1. Abre **[vercel.com](https://vercel.com)**.
2. Inicia sesión con **GitHub** (recomendado para conectar el repo directamente).

---

## 2. Importar el proyecto

1. Pulsa **Add New…** → **Project**.
2. Si no ves tus repos, pulsa **Configure GitHub App** y autoriza a Vercel.
3. Busca el repositorio **Casa Inteligente** (o el nombre que le hayas puesto) y pulsa **Import**.

---

## 3. Configuración del proyecto

En la pantalla de configuración:

| Campo | Qué poner |
|-------|-----------|
| **Framework Preset** | Debe aparecer **Next.js** (Vercel lo detecta). No lo cambies. |
| **Root Directory** | Déjalo vacío (raíz del repo). |
| **Build Command** | `npm run build` (por defecto). |
| **Output Directory** | Por defecto para Next.js. |
| **Install Command** | `npm install` (por defecto). |

No hagas **Deploy** todavía.

---

## 4. Añadir variables de entorno (importante)

1. En la misma pantalla, desplázate hasta **Environment Variables**.
2. Añade estas dos variables (usa los valores de tu proyecto en Supabase):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` (tu Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave **anon public** (empieza por `eyJ...`) |

3. Marca **Production** (y **Preview** si quieres que los previews también usen Supabase).
4. Pulsa **Add** para cada una.

---

## 5. Deploy

1. Pulsa **Deploy**.
2. Espera a que termine el build (1–2 minutos).
3. Cuando termine, verás la URL de la app, por ejemplo: `casa-inteligente-xxx.vercel.app`.

---

## 6. Comprobar

- Abre la URL que te ha dado Vercel.
- Deberías ver la página de inicio **Casa Inteligente** y el botón **Menú** → **Empresas**.

---

## Después de configurar

- **Cada push a la rama principal** (p. ej. `main`) disparará un nuevo deploy automático.
- Para cambiar variables: **Settings** → **Environment Variables** → editar → **Redeploy** en la pestaña Deployments.
- Dominio propio: **Settings** → **Domains** (opcional).

Si el build falla, revisa que las dos variables de Supabase estén bien escritas y sin espacios.
