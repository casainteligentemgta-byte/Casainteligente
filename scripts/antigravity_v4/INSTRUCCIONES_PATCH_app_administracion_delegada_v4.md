# Patch: `app_administracion_delegada_v4.py` → Supabase

El archivo **no está en el repo Casa Inteligente**. Vive en el proyecto Antigravity del suegro.
Aquí va el módulo listo (`db_supabase.py`) y cómo engancharlo.

## 1. Copiar al proyecto Streamlit V4

```
tu_proyecto_v4/
  app_administracion_delegada_v4.py
  db_supabase.py          ← copiar desde scripts/antigravity_v4/db_supabase.py
  .session_database.csv   ← se mantiene (caché offline)
  .streamlit/secrets.toml ← ver secrets.toml.example
```

```bash
pip install -r requirements-streamlit-supabase.txt
```

## 2. Secrets

`.streamlit/secrets.toml`:

```toml
[supabase]
url = "https://XXXX.supabase.co"
key = "eyJ...."
database_url = "postgresql://postgres.[ref]:[pass]@...pooler.supabase.com:6543/postgres"
```

## 3. Cambios en `app_administracion_delegada_v4.py`

### Quitar / no usar
- `import sqlite3`
- `sqlite3.connect("database_v4.db")` (o ruta local)
- Cualquier `DELETE FROM transacciones` / `DELETE FROM ...` masivo antes de recargar
- Placeholders `?` en SQL → usar `%s` (psycopg2)

### Agregar al inicio
```python
from db_supabase import get_db, pg_date, pg_concat, pg_upper

db = get_db(cache_path=".session_database.csv")
```

### Leer datos
```python
# Antes
# conn = sqlite3.connect(...)
# df = pd.read_sql("SELECT * FROM transacciones", conn)

# Ahora
rows = db.load_transacciones_with_fallback()  # online o CSV offline
# o:
rows = db.fetchall("SELECT * FROM transacciones WHERE UPPER(clase) = %s ORDER BY id", ("GASTO",))
```

### Guardar / editar (IDs estables)
```python
# PROHIBIDO:
# cur.execute("DELETE FROM transacciones")
# luego insertar todo de nuevo

# CORRECTO:
db.upsert(
    "transacciones",
    {
        "id": int(row["id"]),
        "clase": row["clase"],
        "fecha": pg_date(row["fecha"]),
        "descripcion": row.get("descripcion"),
        "moneda": row.get("moneda") or "USD",
        "monto_base_usd": row.get("monto_base_usd"),
        "monto_pagado": row.get("monto_pagado"),
        "honorarios": row.get("honorarios"),
        "costo_total": row.get("costo_total"),
        "porcentaje_admin": row.get("porcentaje_admin"),
        "estado": row.get("estado"),
        # ... resto de columnas
    },
    conflict_cols=("id",),
)
```

### Fechas y catálogos (PostgreSQL)
| SQLite | PostgreSQL |
|--------|------------|
| `date('now')` | `CURRENT_DATE` |
| `datetime('now')` | `NOW()` |
| `a \|\| b` con NULL | `pg_concat("a", "b")` → `COALESCE(a::text,'') \|\| ...` |
| `WHERE clase = 'gasto'` | `WHERE UPPER(clase) = 'GASTO'` |
| placeholders `?` | `%s` |

### Caché `.session_database.csv`
- Se **conserva**.
- `upsert` escribe merge por `id` en el CSV.
- Si no hay internet, `load_transacciones_with_fallback()` lee el CSV.
- Nunca borrar el CSV al fallar la red.

## 4. Tablas en Supabase

Las tablas V4 (`transacciones`, `proveedores`, `tipos_gasto`, …) deben existir en Postgres
(con `id` integer PK). Si aún solo están el modelo Casa Inteligente (`contabilidad_compras`
+ `origen_v4_id`), **no** apuntes el Streamlit directo a esas tablas sin migración de schema.

Opciones:
1. Crear schema espejo V4 en Supabase (tablas iguales al SQLite), o
2. Seguir exportando CSV → import CI (puente actual), y usar este adapter solo cuando el schema V4 esté en Postgres.

## 5. Prompt para Antigravity (con el .py abierto)

Ver `PROMPT_APLICAR_SUPABASE_EN_APP_V4.md` en esta carpeta.
