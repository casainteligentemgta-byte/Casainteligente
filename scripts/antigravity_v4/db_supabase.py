"""
Capa de datos CCO V4 → Supabase (PostgreSQL) para Streamlit.

Uso en app_administracion_delegada_v4.py:
    from db_supabase import get_db
    db = get_db()
    rows = db.fetchall("SELECT * FROM transacciones WHERE clase = %s ORDER BY id", ("GASTO",))
    db.upsert("transacciones", {"id": 1, "clase": "GASTO", "monto_base_usd": 100}, conflict_cols=("id",))

Credenciales (Streamlit secrets):
    [supabase]
    url = "https://XXXX.supabase.co"
    key = "eyJ..."   # service_role o anon con RLS adecuada
    # Opcional (recomendado para SQL/transacciones):
    database_url = "postgresql://postgres.[ref]:[pass]@aws-0-....pooler.supabase.com:6543/postgres"

Caché offline: .session_database.csv (no se elimina la lógica; si no hay red, lee/escribe CSV).
Nunca hace DELETE FROM masivo: solo UPSERT por ID (ON CONFLICT).
"""

from __future__ import annotations

import csv
import os
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional, Sequence

# ---------------------------------------------------------------------------
# Secrets / env
# ---------------------------------------------------------------------------

CACHE_CSV_DEFAULT = ".session_database.csv"


def _secret(key: str, default: str = "") -> str:
    """Lee st.secrets o variables de entorno."""
    try:
        import streamlit as st  # type: ignore

        # Formato anidado: st.secrets["supabase"]["url"]
        if "supabase" in st.secrets:
            block = st.secrets["supabase"]
            if key in block:
                return str(block[key]).strip()
            # alias
            aliases = {
                "url": ["supabase_url", "URL"],
                "key": ["supabase_key", "KEY", "anon_key", "service_role_key"],
                "database_url": ["DATABASE_URL", "db_url", "connection_string"],
            }
            for alt in aliases.get(key, []):
                if alt in block:
                    return str(block[alt]).strip()
        # Formato plano legacy
        flat = f"supabase_{key}" if not key.startswith("supabase") else key
        if flat in st.secrets:
            return str(st.secrets[flat]).strip()
        if key in st.secrets:
            return str(st.secrets[key]).strip()
    except Exception:
        pass

    env_map = {
        "url": ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
        "key": ["SUPABASE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"],
        "database_url": ["DATABASE_URL", "SUPABASE_DB_URL"],
    }
    for env in env_map.get(key, [key.upper()]):
        v = (os.environ.get(env) or "").strip()
        if v:
            return v
    return default


def _pg_connect():
    """Conexión Postgres (psycopg2). Preferida para transacciones Streamlit."""
    import psycopg2
    from psycopg2.extras import RealDictCursor

    dsn = _secret("database_url")
    if not dsn:
        raise RuntimeError(
            "Falta database_url en st.secrets['supabase']['database_url'] "
            "(Connection string de Supabase → Settings → Database → URI)."
        )
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    return conn, RealDictCursor


def _supabase_client():
    from supabase import create_client

    url = _secret("url")
    key = _secret("key")
    if not url or not key:
        raise RuntimeError(
            "Faltan st.secrets['supabase']['url'] y st.secrets['supabase']['key']."
        )
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Utilidades PG
# ---------------------------------------------------------------------------

def pg_date(value: Any) -> Optional[str]:
    """Normaliza fecha a ISO YYYY-MM-DD (PostgreSQL date)."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    s = str(value).strip()
    if not s:
        return None
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    # DD/MM/YYYY
    parts = s.replace(".", "/").replace("-", "/").split("/")
    if len(parts) == 3 and len(parts[2]) == 4:
        d, m, y = parts[0].zfill(2), parts[1].zfill(2), parts[2]
        return f"{y}-{m}-{d}"
    return s[:10]


def pg_upper(expr: str) -> str:
    """UPPER() compatible PG (catálogos case-insensitive)."""
    return f"UPPER({expr})"


def pg_concat(*parts: str) -> str:
    """Concatenación PG: a || b || c (no || de SQLite con NULL raro: usa COALESCE)."""
    safe = [f"COALESCE({p}::text, '')" for p in parts]
    return " || ".join(safe)


# ---------------------------------------------------------------------------
# Caché CSV offline (.session_database.csv)
# ---------------------------------------------------------------------------

class SessionCsvCache:
    """Respaldo local offline. No borra el archivo; hace merge por id."""

    def __init__(self, path: str | Path = CACHE_CSV_DEFAULT):
        self.path = Path(path)

    def exists(self) -> bool:
        return self.path.is_file() and self.path.stat().st_size > 0

    def load(self) -> list[dict[str, Any]]:
        if not self.exists():
            return []
        with self.path.open("r", encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    def upsert_rows(
        self,
        rows: Iterable[Mapping[str, Any]],
        id_col: str = "id",
    ) -> None:
        """Fusiona por id: actualiza existentes, agrega nuevos. Nunca trunca a ciegas."""
        by_id: dict[str, dict[str, Any]] = {}
        fieldnames: list[str] = []

        for old in self.load():
            key = str(old.get(id_col, "")).strip()
            if key:
                by_id[key] = dict(old)
            for k in old.keys():
                if k not in fieldnames:
                    fieldnames.append(k)

        for row in rows:
            r = {k: ("" if v is None else v) for k, v in dict(row).items()}
            key = str(r.get(id_col, "")).strip()
            if not key:
                continue
            if key in by_id:
                by_id[key].update(r)
            else:
                by_id[key] = r
            for k in r.keys():
                if k not in fieldnames:
                    fieldnames.append(k)

        if not fieldnames:
            return
        if id_col not in fieldnames:
            fieldnames.insert(0, id_col)

        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            w.writeheader()
            for key in sorted(by_id.keys(), key=lambda x: int(x) if x.isdigit() else x):
                w.writerow(by_id[key])
        tmp.replace(self.path)


# ---------------------------------------------------------------------------
# Database principal
# ---------------------------------------------------------------------------

class CcoSupabaseDB:
    """
    Fachada Postgres para el app Streamlit V4.
    - SQL vía psycopg2 (eficiente, transacciones)
    - API supabase-py opcional (self.client)
    - Caché CSV si falla la red
    """

    def __init__(self, cache_path: str | Path = CACHE_CSV_DEFAULT):
        self.cache = SessionCsvCache(cache_path)
        self._conn = None
        self._dict_cursor_factory = None
        self._online = False
        self._client = None
        self._connect()

    def _connect(self) -> None:
        try:
            self._conn, self._dict_cursor_factory = _pg_connect()
            self._online = True
            try:
                self._client = _supabase_client()
            except Exception:
                self._client = None
        except Exception as e:
            self._online = False
            self._conn = None
            self._last_error = str(e)

    @property
    def online(self) -> bool:
        return bool(self._online and self._conn is not None)

    @property
    def client(self):
        """Cliente supabase-py (opcional)."""
        return self._client

    def reconnect(self) -> bool:
        self.close()
        self._connect()
        return self.online

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
        self._conn = None
        self._online = False

    @contextmanager
    def cursor(self, dict_rows: bool = True):
        if not self.online:
            raise RuntimeError(self._offline_msg())
        assert self._conn is not None
        cur = (
            self._conn.cursor(cursor_factory=self._dict_cursor_factory)
            if dict_rows
            else self._conn.cursor()
        )
        try:
            yield cur
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise
        finally:
            cur.close()

    def _offline_msg(self) -> str:
        err = getattr(self, "_last_error", "sin detalle")
        return (
            f"Sin conexión a Supabase ({err}). "
            f"Usando caché local {self.cache.path} si existe."
        )

    # ----- queries -----

    def execute(self, sql: str, params: Sequence[Any] | None = None) -> None:
        """Ejecuta DML/DDL. Usa %s como placeholder (psycopg2), no ? de SQLite."""
        sql_pg = _sqlite_placeholders_to_pg(sql)
        with self.cursor(dict_rows=False) as cur:
            cur.execute(sql_pg, params or ())

    def fetchall(
        self, sql: str, params: Sequence[Any] | None = None
    ) -> list[dict[str, Any]]:
        sql_pg = _sqlite_placeholders_to_pg(sql)
        try:
            with self.cursor(dict_rows=True) as cur:
                cur.execute(sql_pg, params or ())
                rows = cur.fetchall() or []
                return [dict(r) for r in rows]
        except Exception:
            # Fallback caché solo para SELECT simples de transacciones
            if self.cache.exists() and "transacciones" in sql.lower():
                return self.cache.load()
            raise

    def fetchone(
        self, sql: str, params: Sequence[Any] | None = None
    ) -> dict[str, Any] | None:
        rows = self.fetchall(sql, params)
        return rows[0] if rows else None

    # ----- UPSERT (IDs estables) -----

    def upsert(
        self,
        table: str,
        row: Mapping[str, Any],
        conflict_cols: Sequence[str] = ("id",),
        update_cols: Sequence[str] | None = None,
    ) -> None:
        """
        INSERT ... ON CONFLICT (...) DO UPDATE.
        No borra la tabla. Preserva IDs para Casa Inteligente (origen_v4_id / id).
        """
        data = dict(row)
        if "fecha" in data:
            data["fecha"] = pg_date(data["fecha"])

        cols = list(data.keys())
        if not cols:
            return
        placeholders = ", ".join(["%s"] * len(cols))
        col_list = ", ".join(_quote_ident(c) for c in cols)
        conflict = ", ".join(_quote_ident(c) for c in conflict_cols)

        to_update = [
            c
            for c in (update_cols or cols)
            if c not in conflict_cols
        ]
        if to_update:
            set_clause = ", ".join(
                f"{_quote_ident(c)} = EXCLUDED.{_quote_ident(c)}" for c in to_update
            )
            sql = (
                f"INSERT INTO {_quote_ident(table)} ({col_list}) VALUES ({placeholders}) "
                f"ON CONFLICT ({conflict}) DO UPDATE SET {set_clause}"
            )
        else:
            sql = (
                f"INSERT INTO {_quote_ident(table)} ({col_list}) VALUES ({placeholders}) "
                f"ON CONFLICT ({conflict}) DO NOTHING"
            )

        values = [data[c] for c in cols]

        if self.online:
            with self.cursor(dict_rows=False) as cur:
                cur.execute(sql, values)
        # Siempre actualiza caché local (respaldo)
        if "id" in data or conflict_cols:
            self.cache.upsert_rows([data], id_col=conflict_cols[0])

    def upsert_many(
        self,
        table: str,
        rows: Iterable[Mapping[str, Any]],
        conflict_cols: Sequence[str] = ("id",),
    ) -> int:
        n = 0
        batch = list(rows)
        for row in batch:
            self.upsert(table, row, conflict_cols=conflict_cols)
            n += 1
        return n

    def load_transacciones_with_fallback(self) -> list[dict[str, Any]]:
        """Carga transacciones online; si falla, .session_database.csv."""
        try:
            if self.online:
                return self.fetchall(
                    "SELECT * FROM transacciones ORDER BY id ASC"
                )
        except Exception:
            self._online = False
        if self.cache.exists():
            return self.cache.load()
        return []

    def sync_cache_from_server(self, table: str = "transacciones") -> int:
        """Refresca el CSV local desde Supabase (merge por id, sin truncar ciego)."""
        if not self.online:
            return 0
        rows = self.fetchall(f"SELECT * FROM {_quote_ident(table)} ORDER BY id")
        self.cache.upsert_rows(rows, id_col="id")
        return len(rows)


_db_singleton: CcoSupabaseDB | None = None


def get_db(cache_path: str | Path = CACHE_CSV_DEFAULT) -> CcoSupabaseDB:
    """Singleton Streamlit-friendly."""
    global _db_singleton
    if _db_singleton is None:
        _db_singleton = CcoSupabaseDB(cache_path=cache_path)
    return _db_singleton


def get_connection():
    """
    Compatibilidad: reemplazo de sqlite3.connect(...).
    Retorna conexión psycopg2 (usar %s, no ?).
    """
    db = get_db()
    if not db.online or db._conn is None:
        raise RuntimeError(db._offline_msg())
    return db._conn


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _quote_ident(name: str) -> str:
    if not name.replace("_", "").isalnum():
        raise ValueError(f"Identificador SQL inválido: {name}")
    return name


def _sqlite_placeholders_to_pg(sql: str) -> str:
    """Convierte ? → %s de forma simple (no dentro de strings complejas)."""
    if "%s" in sql:
        return sql
    out: list[str] = []
    in_str = False
    quote = ""
    i = 0
    while i < len(sql):
        ch = sql[i]
        if in_str:
            out.append(ch)
            if ch == quote:
                in_str = False
            i += 1
            continue
        if ch in ("'", '"'):
            in_str = True
            quote = ch
            out.append(ch)
            i += 1
            continue
        if ch == "?":
            out.append("%s")
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)
