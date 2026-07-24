#!/usr/bin/env python3
"""
Exporta capítulos desde MDB LuloWin al formato cascada de Supabase:
  codigo,nombre

Uso:
  python scripts/export-capitulos-cascada.py "C:\\ruta\\obra.mdb" --cod-obr "01"
  python scripts/export-capitulos-cascada.py "./obra.mdb" --cod-obr "PDVSA" --out "./migracion_capitulos.csv"

Requisitos (Windows):
  pip install -r scripts/requirements-mdb-export.txt
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
import pyodbc


def conectar(mdb_path: Path) -> pyodbc.Connection:
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"DBQ={mdb_path.resolve()};"
    )
    return pyodbc.connect(conn_str)


def to_int(value: object, fallback: int | None = None) -> int | None:
    try:
        if value is None or str(value).strip() == "":
            return fallback
        return int(float(value))
    except Exception:
        return fallback


def exportar_capitulos(
    conn: pyodbc.Connection,
    cod_obr: str,
    pad_width: int,
    proyecto_id: str | None,
    presupuesto_lulo_id: str | None,
) -> pd.DataFrame:
    query = """
        SELECT
            c.CodObr,
            c.CodCap,
            c.NumCap,
            c.DesCap AS DesCapBase,
            d.DesCap AS DesCapExt
        FROM ObraCapi AS c
        LEFT JOIN ObraCapiDesc AS d ON c.CodCap = d.CodCap
        WHERE c.CodObr = ?
        ORDER BY c.NumCap ASC
    """
    raw = pd.read_sql(query, conn, params=[cod_obr])
    if raw.empty:
        return pd.DataFrame(columns=["codigo", "nombre"])

    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for _, r in raw.iterrows():
        num_cap = to_int(r.get("NumCap"))
        cod_cap = to_int(r.get("CodCap"))
        numero = num_cap if num_cap is not None else cod_cap
        if numero is None or numero <= 0:
            continue

        codigo = str(numero).zfill(pad_width) if pad_width > 0 else str(numero)
        nombre = str(r.get("DesCapExt") or r.get("DesCapBase") or f"Capítulo {numero}").strip()
        if not nombre:
            nombre = f"Capítulo {numero}"

        dedupe_key = f"{codigo}|{nombre}".upper()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        row: dict[str, str] = {
            "codigo": codigo,
            "nombre": nombre[:500],
        }
        if proyecto_id:
            row["proyecto_id"] = proyecto_id.strip()
        if presupuesto_lulo_id:
            row["presupuesto_lulo_id"] = presupuesto_lulo_id.strip()
        rows.append(row)

    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["codigo", "nombre"])
    return df.sort_values(by=["codigo", "nombre"], ascending=[True, True], kind="stable")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Exportar capítulos MDB al formato public.capitulos (codigo,nombre)."
    )
    parser.add_argument("mdb", type=Path, help="Ruta al archivo .mdb / .accdb")
    parser.add_argument("--cod-obr", required=True, help="Código de obra (ObraCapi.CodObr)")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("migracion_capitulos.csv"),
        help="CSV de salida (default: ./migracion_capitulos.csv)",
    )
    parser.add_argument(
        "--pad-width",
        type=int,
        default=2,
        help="Relleno de ceros para codigo (default: 2; use 0 para sin relleno)",
    )
    parser.add_argument(
        "--proyecto-id",
        type=str,
        default=None,
        help="Opcional: agrega columna proyecto_id en el CSV",
    )
    parser.add_argument(
        "--presupuesto-lulo-id",
        type=str,
        default=None,
        help="Opcional: agrega columna presupuesto_lulo_id en el CSV",
    )
    args = parser.parse_args()

    if not args.mdb.is_file():
        print(f"Error: no existe el archivo {args.mdb}", file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)

    try:
        conn = conectar(args.mdb)
    except pyodbc.Error as e:
        print("Error de conexión ODBC con Access.", file=sys.stderr)
        print(e, file=sys.stderr)
        return 1

    try:
        df = exportar_capitulos(
            conn=conn,
            cod_obr=args.cod_obr.strip(),
            pad_width=max(0, int(args.pad_width)),
            proyecto_id=args.proyecto_id,
            presupuesto_lulo_id=args.presupuesto_lulo_id,
        )
        if df.empty:
            print(
                f"No se encontraron capítulos para CodObr='{args.cod_obr}' en ObraCapi.",
                file=sys.stderr,
            )
            return 1

        df.to_csv(args.out, index=False, encoding="utf-8-sig")
        print(f"Listo: {len(df)} capítulos exportados -> {args.out.resolve()}")
        print("Columnas:", ", ".join(df.columns))
        return 0
    except Exception as e:
        print("Error exportando capítulos:", e, file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
