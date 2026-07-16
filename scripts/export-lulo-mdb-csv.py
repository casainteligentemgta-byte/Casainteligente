#!/usr/bin/env python3
"""
Exporta tablas de un presupuesto LuloWin (.mdb / .accdb) a CSV.

Requisitos (Windows):
  pip install pandas pyodbc
  Driver: "Microsoft Access Database Engine" o "Microsoft Access Driver (*.mdb, *.accdb)"

Uso:
  python scripts/export-lulo-mdb-csv.py "C:\\ruta\\576PDVSA.MDB"
  python scripts/export-lulo-mdb-csv.py ./576PDVSA.MDB --out ./export_lulo
  python scripts/export-lulo-mdb-csv.py ./obra.mdb --solo-criticas
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
import pyodbc

TABLAS_CRITICAS = frozenset(
    {"ObraApun", "ObraPart", "ObraMate", "ObraMano", "ObraEqui"}
)


def conectar(mdb_path: Path) -> pyodbc.Connection:
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"DBQ={mdb_path.resolve()};"
    )
    return pyodbc.connect(conn_str)


def listar_tablas(conn: pyodbc.Connection) -> list[str]:
    cursor = conn.cursor()
    return sorted(
        t.table_name
        for t in cursor.tables(tableType="TABLE")
        if t.table_name and not t.table_name.startswith("MSys")
    )


def exportar_tabla(conn: pyodbc.Connection, tabla: str, out_dir: Path) -> int:
    query = f"SELECT * FROM [{tabla}]"
    df = pd.read_sql(query, conn)
    dest = out_dir / f"migracion_{tabla}.csv"
    df.to_csv(dest, index=False, encoding="utf-8-sig")
    return len(df)


def main() -> int:
    parser = argparse.ArgumentParser(description="Exportar MDB Lulo a CSV")
    parser.add_argument("mdb", type=Path, help="Ruta al archivo .mdb / .accdb")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("export_lulo_csv"),
        help="Carpeta de salida (default: ./export_lulo_csv)",
    )
    parser.add_argument(
        "--solo-criticas",
        action="store_true",
        help="Solo ObraApun, ObraPart, ObraMate, ObraMano, ObraEqui",
    )
    parser.add_argument(
        "--todas-obra",
        action="store_true",
        help="Todas las tablas que empiezan con Obra (default si no --solo-criticas)",
    )
    args = parser.parse_args()

    mdb = args.mdb
    if not mdb.is_file():
        print(f"Error: no existe el archivo {mdb}", file=sys.stderr)
        return 1

    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        conn = conectar(mdb)
    except pyodbc.Error as e:
        print("Error de conexión. ¿Instalado el driver Access ODBC?", file=sys.stderr)
        print(e, file=sys.stderr)
        return 1

    try:
        tablas = listar_tablas(conn)
        print("Tablas encontradas:", ", ".join(tablas))

        if args.solo_criticas:
            objetivo = [t for t in tablas if t in TABLAS_CRITICAS]
        else:
            objetivo = [t for t in tablas if t in TABLAS_CRITICAS or t.startswith("Obra")]

        if not objetivo:
            print("No hay tablas Obra* para exportar.", file=sys.stderr)
            return 1

        for tabla in objetivo:
            filas = exportar_tabla(conn, tabla, out_dir)
            print(f"Exportada: {tabla} ({filas} filas) -> {out_dir / f'migracion_{tabla}.csv'}")

        print(f"\nListo. CSV en: {out_dir.resolve()}")
        return 0
    except Exception as e:
        print("Error en la extracción:", e, file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
