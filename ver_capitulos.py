#!/usr/bin/env python3
"""
Mapea capítulos LuloWin desde cualquier .mdb (ObraCapi + ObraCapiDesc).

Ejemplos:
  python ver_capitulos.py --mdb "C:\\ruta\\FLAMBO1E (1).MDB"
  python ver_capitulos.py --mdb ./obra.mdb --cod-obr FLAMBO1E --json capitulos.json
  python ver_capitulos.py --mdb ./obra.mdb --inner --csv migracion_capitulos.csv

Requisitos: pip install pandas pyodbc + driver Access ODBC.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import pyodbc


def extraer_capitulos_automatico(
    ruta_archivo_mdb: str | Path,
    *,
    cod_obr: str | None = None,
    inner_join: bool = False,
) -> list[dict[str, Any]] | None:
    """
    Mapea la estructura de capítulos de LuloWin desde un .mdb nativo.
    Consulta maestra: ObraCapi + ObraCapiDesc, orden por NumCap.

    Por defecto LEFT JOIN + descripción de respaldo (ObraCapi.DesCap).
    Con inner_join=True replica solo filas con ObraCapiDesc (INNER JOIN).
    """
    mdb = Path(ruta_archivo_mdb).resolve()
    if not mdb.is_file():
        raise FileNotFoundError(f"No existe el archivo MDB: {mdb}")

    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"DBQ={mdb};"
    )

    if inner_join:
        join_sql = "INNER JOIN ObraCapiDesc AS d ON c.CodCap = d.CodCap"
        desc_sql = "d.DesCap AS descripcion"
    else:
        join_sql = "LEFT JOIN ObraCapiDesc AS d ON c.CodCap = d.CodCap"
        desc_sql = "Nz(d.DesCap, c.DesCap) AS descripcion"

    if cod_obr:
        where_sql = "WHERE c.CodObr = ?"
        params: list[str] = [cod_obr.strip()]
    else:
        where_sql = ""
        params = []

    query = f"""
        SELECT
            c.NumCap AS numero_capitulo,
            {desc_sql}
        FROM ObraCapi AS c
        {join_sql}
        {where_sql}
        ORDER BY c.NumCap ASC
    """

    conn = None
    try:
        conn = pyodbc.connect(conn_str)
        df = pd.read_sql(query, conn, params=params) if params else pd.read_sql(query, conn)
    except Exception as e:
        print(f"Error al procesar la estructura del MDB: {e}", file=sys.stderr)
        return None
    finally:
        if conn is not None:
            conn.close()

    if df.empty:
        return []

    df["descripcion"] = df["descripcion"].astype(str).str.strip()
    df["numero_capitulo"] = pd.to_numeric(df["numero_capitulo"], errors="coerce").fillna(0).astype(int)

    # Deduplicar por número de capítulo (conservar primera descripción)
    seen: set[int] = set()
    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        num = int(row["numero_capitulo"])
        if num <= 0 or num in seen:
            continue
        seen.add(num)
        descripcion = str(row["descripcion"] or f"Capítulo {num}").strip()[:500]
        rows.append(
            {
                "numero_capitulo": num,
                "descripcion": descripcion,
                # Alias para migración cascada Supabase (codigo + nombre)
                "codigo": str(num).zfill(2),
                "nombre": descripcion,
            }
        )

    return rows


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extraer capítulos ObraCapi (+ ObraCapiDesc) desde MDB LuloWin",
    )
    parser.add_argument("--mdb", type=Path, default=Path("FLAMBO1E.MDB"), help="Ruta al .mdb")
    parser.add_argument("--cod-obr", type=str, default=None, help="Filtrar por CodObr")
    parser.add_argument(
        "--inner",
        action="store_true",
        help="INNER JOIN solo con ObraCapiDesc (consulta estricta Lulo)",
    )
    parser.add_argument("--csv", type=Path, default=None, help="Exportar CSV utf-8-sig")
    parser.add_argument("--json", type=Path, default=None, help="Exportar JSON para Supabase/API")
    args = parser.parse_args()

    resultado = extraer_capitulos_automatico(
        args.mdb,
        cod_obr=args.cod_obr,
        inner_join=args.inner,
    )
    if resultado is None:
        return 1

    print("\n=== CAPÍTULOS DETECTADOS EN EL PROYECTO ===")
    if not args.cod_obr:
        print("(Sin --cod-obr: todas las filas ObraCapi del archivo.)")
    if not resultado:
        print("La tabla de capítulos está vacía o el formato difiere.")
    else:
        for cap in resultado:
            print(f"Capítulo {cap['numero_capitulo']}: {cap['descripcion']}")
        if args.csv:
            pd.DataFrame(resultado)[["codigo", "nombre"]].rename(
                columns={"codigo": "codigo", "nombre": "nombre"}
            ).to_csv(args.csv, index=False, encoding="utf-8-sig")
            print(f"\nCSV: {args.csv.resolve()} ({len(resultado)} filas)")
        if args.json:
            args.json.parent.mkdir(parents=True, exist_ok=True)
            payload = [{"numero_capitulo": c["numero_capitulo"], "descripcion": c["descripcion"]} for c in resultado]
            args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"JSON: {args.json.resolve()} ({len(resultado)} capítulos)")
    print("===========================================\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
