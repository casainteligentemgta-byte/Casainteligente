#!/usr/bin/env python3
"""
Recomendación de pruebas Pheme (prototipo / CLI).

Equivalente en app: POST /api/talento/pheme/recomendar
y lib/talento/pheme/recomendarPruebasPheme.ts

Requiere migración 290_ci_pheme_pruebas_triggers.sql aplicada.
Variables: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
(o DATABASE_URL).
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Instala psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
    raise


STOPWORDS = {
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "y",
    "o",
    "en",
    "para",
    "por",
    "con",
    "a",
    "al",
}


def quitar_acentos(texto: str) -> str:
    nfd = unicodedata.normalize("NFD", texto)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def extraer_palabras_clave(texto: str) -> list[str]:
    raw = quitar_acentos((texto or "").lower())
    tokens = re.split(r"[^a-z0-9]+", raw)
    out: list[str] = []
    seen: set[str] = set()
    for t in tokens:
        t = t.strip()
        if len(t) < 2 or t in STOPWORDS or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def obtener_conexion():
    """Conexión a PostgreSQL (Supabase / local)."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return psycopg2.connect(database_url)

    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


def recomendar_pruebas_pheme(palabras_clave_busqueda: list[str]):
    """
    Busca en la base de datos las pruebas psicológicas recomendadas
    según las palabras clave detectadas en la solicitud.
    """
    palabras = [quitar_acentos(p.lower().strip()) for p in palabras_clave_busqueda if p and p.strip()]
    if not palabras:
        return []

    conn = obtener_conexion()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT * FROM public.ci_recomendar_pruebas_pheme(%s)",
            (palabras,),
        )
        pruebas_sugeridas = cursor.fetchall()
        cursor.close()
        return pruebas_sugeridas
    finally:
        conn.close()


if __name__ == "__main__":
    # Simulación: el usuario pide a Pheme evaluar a un "técnico de CCTV"
    texto = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "tecnico de cctv"
    palabras_detectadas = extraer_palabras_clave(texto)

    resultados = recomendar_pruebas_pheme(palabras_detectadas)

    print(f"--- Batería de Pruebas Recomendadas para {palabras_detectadas} ---")
    print(json.dumps(resultados, indent=2, ensure_ascii=False, default=str))
