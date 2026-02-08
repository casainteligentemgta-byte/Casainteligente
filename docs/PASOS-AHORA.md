# Pasos a seguir ahora

Sigue este orden para tener la app funcionando en local y en Vercel.

---

## 1. Comprobar el deploy en Vercel

1. Entra en **[vercel.com](https://vercel.com)** e inicia sesión.
2. Abre tu proyecto **Casainteligente** (o el nombre que tenga).
3. Ve a la pestaña **Deployments**.
   - Si hay un deploy **en curso** o **reciente** (después del último push), espera a que termine.
   - Si el último deploy **falló**, haz clic en los tres puntos **⋮** → **Redeploy**.
4. Cuando el estado sea **Ready**, haz clic en la **URL** (ej. `casainteligente-xxx.vercel.app`).
5. Deberías ver la página **Casa Inteligente** y el botón **Menú**.

**Si el deploy sigue fallando:**  
Ve a **Settings** → **General** y asegúrate de que **Root Directory** esté **vacío**. Guarda y vuelve a **Redeploy**.

**Si ves "404: NOT FOUND" al abrir la URL:**
1. En **Deployments**, confirma que el último deploy está en estado **Ready** (verde). Si está en **Error** o **Canceled**, ese deploy no sirve: haz **Redeploy** o corrige el error del build.
2. Abre la **URL principal** del proyecto (la que sale en la cabecera del proyecto, ej. `https://casainteligente-xxx.vercel.app`), no una URL de una rama o preview que no exista.
3. Prueba exactamente la raíz: `https://tu-dominio.vercel.app/` (con la barra final).
4. Si sigue el 404: en **Settings** → **General**, deja **Root Directory** vacío y **Framework Preset** en **Next.js**. Guarda y en **Deployments** → **⋮** → **Redeploy**.

---

## 2. Variables de entorno en Vercel

1. En el mismo proyecto de Vercel, ve a **Settings** → **Environment Variables**.
2. Comprueba que existan estas dos variables (si no, créalas):

   | Name                         | Value                    |
   |-----------------------------|--------------------------|
   | `NEXT_PUBLIC_SUPABASE_URL`  | `https://xxxxx.supabase.co` (tu Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu clave **anon public** de Supabase |

3. Si acabas de añadir o cambiar alguna, ve a **Deployments** → **⋮** en el último deploy → **Redeploy** para que se apliquen.

---

## 3. Crear la tabla de empresas en Supabase

Para que la pantalla **Empresas** guarde y muestre datos:

1. Entra en **[supabase.com](https://supabase.com)** y abre tu proyecto.
2. En el menú izquierdo, ve a **SQL Editor**.
3. Pulsa **New query**.
4. Abre en tu ordenador el archivo **`supabase/migrations/002_empresas.sql`** (está en la carpeta del proyecto Casa Inteligente).
5. Copia **todo** el contenido del archivo y pégalo en el editor SQL de Supabase.
6. Pulsa **Run** (o Ctrl+Enter).
7. Deberías ver el mensaje de que la consulta se ejecutó correctamente.

Con esto ya existe la tabla **empresas** y la app puede guardar y listar empresas.

---

## 4. Probar la app en la URL de Vercel

1. Abre la URL de tu app en Vercel (ej. `https://tu-proyecto.vercel.app`).
2. Pulsa **Menú** → **Empresas**.
3. Deberías ver la pantalla de Empresas (tabla vacía o con datos).
4. Pulsa **+ Añadir empresa**, rellena al menos el **Nombre** y **Guardar**.
5. Comprueba que la nueva empresa aparece en la tabla.

Si algo no carga o da error, revisa que en Vercel estén bien las variables del paso 2 y que hayas ejecutado el SQL del paso 3.

---

## 5. (Opcional) Probar en tu PC

1. En la carpeta del proyecto, abre terminal y ejecuta:
   ```bash
   npm install
   ```
2. Copia el archivo de ejemplo de variables de entorno:
   - En **Windows (PowerShell):**  
     `Copy-Item .env.example .env.local`
   - En **Mac/Linux:**  
     `cp .env.example .env.local`
3. Abre **`.env.local`** y pega los mismos valores que en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Arranca la app:
   ```bash
   npm run dev
   ```
5. Abre **[http://localhost:3000](http://localhost:3000)** y prueba Menú → Empresas.

---

## Resumen rápido

| Paso | Dónde        | Acción |
|------|--------------|--------|
| 1    | Vercel       | Comprobar que el último deploy esté **Ready** y abrir la URL. Root Directory vacío si falla. |
| 2    | Vercel       | Settings → Environment Variables: tener `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Redeploy si cambias algo. |
| 3    | Supabase     | SQL Editor → ejecutar todo el contenido de `supabase/migrations/002_empresas.sql`. |
| 4    | Navegador    | Abrir la URL de Vercel → Menú → Empresas → añadir una empresa y comprobar que se guarda. |
| 5    | (Opcional)   | Local: `.env.local` con las mismas variables y `npm run dev` para probar en el PC. |

Cuando termines estos pasos, la app estará funcionando en Vercel y podrás usar la pantalla de Empresas con datos guardados en Supabase.
