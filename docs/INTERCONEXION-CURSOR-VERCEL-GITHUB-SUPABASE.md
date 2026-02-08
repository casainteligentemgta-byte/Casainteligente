# Interconexión: Cursor · GitHub · Vercel · Supabase

Guía para conectar el proyecto **Casa Inteligente** con las cuatro herramientas.

---

## Para ver la página en Vercel (orden recomendado)

Sigue estos pasos **en este orden** para que la app se vea en Vercel y no falle el primer build:

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| **1** | **Supabase** | [supabase.com](https://supabase.com) → New project → cuando esté listo, **Project Settings → API**. Anota **Project URL** y **anon public** (clave pública). |
| **2** | **GitHub** | [github.com](https://github.com) → New repository (vacío). En la carpeta del proyecto: `git init`, `git add .`, `git commit -m "Initial commit"`, `git branch -M main`, `git remote add origin https://github.com/TU_USUARIO/TU_REPO.git`, `git push -u origin main`. |
| **3** | **Vercel** | [vercel.com](https://vercel.com) → **Add New → Project** → Import el repo de GitHub. **Antes de dar a Deploy**, en **Environment Variables** añade: `NEXT_PUBLIC_SUPABASE_URL` (la URL) y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la anon key). Marca Production (y Preview si quieres). Luego **Deploy**. |
| **4** | Comprobar | Abre la URL que te da Vercel (ej. `tu-proyecto.vercel.app`). Deberías ver "Casa Inteligente" y el botón Menú. |

A partir de ahí, cada **push a `main`** en GitHub generará un nuevo deploy en Vercel. Las variables de Supabase ya están configuradas para cuando añadas la pantalla de empresas y la base de datos.

---

## Resumen del flujo

```
Cursor (desarrollo)  →  GitHub (código)  →  Vercel (deploy)
                              ↓
                        Supabase (BD, auth, API)
```

- **Cursor**: donde escribes código y haces commit/push.
- **GitHub**: repositorio; cada push puede disparar un deploy en Vercel.
- **Vercel**: construye y publica la app; usa variables de Supabase.
- **Supabase**: base de datos, autenticación y APIs; se conecta desde la app desplegada en Vercel.

---

## 1. GitHub (repositorio)

### Si aún no tienes el repo en GitHub

1. Crea un repositorio nuevo en [github.com](https://github.com) (puedes dejarlo vacío, sin README).
2. En la carpeta del proyecto (en Cursor o terminal):

   ```bash
   git init
   git add .
   git commit -m "Initial commit - Casa Inteligente"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```

   Sustituye `TU_USUARIO` y `TU_REPO` por tu usuario y nombre del repositorio.

### Si ya tienes el repo

- Asegúrate de que `git remote -v` apunte a tu repo de GitHub.
- Trabaja en Cursor con `git add`, `commit` y `push` como siempre.

---

## 2. Vercel (deploy desde GitHub)

1. Entra en [vercel.com](https://vercel.com) e inicia sesión (con GitHub si quieres).
2. **Add New… → Project**.
3. **Import** el repositorio de GitHub (conecta tu cuenta de GitHub si no lo has hecho).
4. Selecciona el repo **Casa Inteligente** (o el nombre que le hayas puesto).
5. Configuración del proyecto:
   - **Framework Preset**: el que uses (Next.js, Vite, etc.); Vercel suele detectarlo.
   - **Root Directory**: dejar por defecto si el código está en la raíz.
   - **Build and Output**: si usas un stack estándar, los valores por defecto suelen bastar.
6. **Environment Variables**: aquí añadirás después las de Supabase (paso 4).
7. **Deploy**. A partir de ahora, cada **push a la rama que hayas elegido** (p. ej. `main`) generará un deploy automático.

---

## 3. Supabase (base de datos y backend)

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta o inicia sesión.
2. **New project**:
   - Organización (o crea una).
   - Nombre del proyecto, contraseña de la base de datos, región.
3. Cuando el proyecto esté listo, ve a **Project Settings** (icono de engranaje) → **API**.
4. Anota:
   - **Project URL** (ej. `https://xxxxx.supabase.co`).
   - **anon public** (clave pública para el cliente).
   - **service_role** (solo para uso en servidor; no exponer en el frontend).

Estos valores los usarás en **variables de entorno** en Vercel y en local (`.env`).

---

## 4. Variables de entorno (Vercel + Cursor local)

### En Vercel

1. En tu proyecto de Vercel: **Settings → Environment Variables**.
2. Añade (para producción y/o preview si quieres):

   | Nombre                | Valor                    | Entorno   |
   |-----------------------|--------------------------|-----------|
   | `NEXT_PUBLIC_SUPABASE_URL` o `VITE_SUPABASE_URL` * | `https://xxxxx.supabase.co` | Production, Preview |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `VITE_SUPABASE_ANON_KEY` * | La clave **anon public** | Production, Preview |

   \* Usa el prefijo según tu stack: `NEXT_PUBLIC_` para Next.js, `VITE_` para Vite.

3. Si tu backend en Vercel llama a Supabase con privilegios de servidor, añade también `SUPABASE_SERVICE_ROLE_KEY` (y opcionalmente la URL si no usas la pública).

4. **Redeploy** el proyecto para que las variables se apliquen.

### En Cursor (desarrollo local)

1. En la raíz del proyecto crea un archivo **`.env.local`** (Next.js) o **`.env`** (Vite u otros).
2. Copia las mismas variables (y valores) que en Vercel, por ejemplo:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. **No subas `.env` ni `.env.local` a GitHub**; deben estar en `.gitignore`.

En el repo ya hay un `.env.example` con los nombres de las variables; puedes copiarlo a `.env.local` y rellenar los valores.

---

## 4b. Crear tablas en Supabase (Casa Inteligente)

Para que la app funcione con datos:

1. En Supabase → **SQL Editor** → **New query**.
2. Ejecuta el contenido de `supabase/migrations/002_empresas.sql` (tabla **empresas** para la pantalla Empresas).
3. Opcional: `001_dispositivos.sql` si usas la sección de dispositivos.

Cada migración crea la tabla y las políticas RLS. Después puedes insertar o editar filas desde la app o desde **Table Editor**.

---

## 5. Comprobar que todo está conectado

| Paso | Comprobación |
|------|----------------|
| Cursor → GitHub | `git push` y ver el último commit en la página del repo. |
| GitHub → Vercel | Tras un push, en Vercel → **Deployments** debe aparecer un nuevo deploy. |
| Vercel → Supabase | La app desplegada debe poder leer/escribir en Supabase (p. ej. login o una tabla). |
| Local | Ejecutar la app en Cursor con `npm run dev` y usar las mismas variables en `.env.local`. |

---

## 6. Resumen de enlaces útiles

- **GitHub**: repositorio del proyecto.
- **Vercel**: dashboard del proyecto → Deployments, Settings, Environment Variables.
- **Supabase**: dashboard del proyecto → Table Editor, SQL, Authentication, API settings.

Si quieres, el siguiente paso puede ser definir el stack (Next.js, Vite, etc.) y la primera integración con Supabase (auth o una tabla para dispositivos de la casa inteligente).
