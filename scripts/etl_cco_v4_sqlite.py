#!/usr/bin/env python3
"""
ETL one-shot: database_v4.db (SQLite CCO V4) → JSON para POST /api/contabilidad/cco/import-v4

Uso:
  python scripts/etl_cco_v4_sqlite.py
  python scripts/etl_cco_v4_sqlite.py --db "c:/Users/matal/Downloads/database_v4.db" --out tmp/cco_v4.json
  python scripts/etl_cco_v4_sqlite.py --proyecto-id <UUID> --post http://localhost:3000

No escribe en Supabase directamente (salvo --post). La app runtime sigue siendo Next.js.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import urllib.request
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description="Export CCO V4 SQLite → JSON import payload")
    ap.add_argument(
        "--db",
        default=r"c:\Users\matal\Downloads\database_v4.db",
        help="Ruta a database_v4.db",
    )
    ap.add_argument("--out", default="tmp/cco_v4_import.json", help="Archivo JSON de salida")
    ap.add_argument("--proyecto-id", default="", help="UUID ci_proyectos destino")
    ap.add_argument("--honorarios", type=float, default=15.0, help="% admin global V4")
    ap.add_argument("--post", default="", help="Base URL app (ej. http://localhost:3000) para POST inmediato")
    ap.add_argument("--no-auto-vincular", action="store_true")
    args = ap.parse_args()

    db = Path(args.db)
    if not db.exists():
        print(f"ERROR: no existe {db}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    prov = {r["id"]: r["nombre"] for r in cur.execute("SELECT id, nombre FROM proveedores")}
    tipos = {r["id"]: r["nombre"] for r in cur.execute("SELECT id, nombre FROM tipos_gasto")}
    formas = {r["id"]: r["nombre"] for r in cur.execute("SELECT id, nombre FROM formas_pago")}
    caps = {
        r["id"]: dict(r)
        for r in cur.execute(
            "SELECT id, nombre, tipo_nivel, padre_id FROM estructura_costos"
        )
    }

    estructura = []
    for cid, c in sorted(caps.items()):
        estructura.append(
            {
                "origen_v4_id": int(cid),
                "nombre": c["nombre"],
                "tipo_nivel": c["tipo_nivel"],
                "padre_origen_v4_id": int(c["padre_id"]) if c["padre_id"] is not None else None,
            }
        )

    transacciones = []
    for r in cur.execute("SELECT * FROM transacciones ORDER BY id"):
        cap = caps.get(r["capitulo_id"])
        sub = caps.get(r["subcapitulo_id"])
        transacciones.append(
            {
                "origen_v4_id": int(r["id"]),
                "clase": r["clase"],
                "fecha": r["fecha"],
                "proveedor": prov.get(r["proveedor_id"]),
                "tipo": tipos.get(r["tipo_gasto_id"]),
                "capitulo": cap["nombre"] if cap else None,
                "subcapitulo": sub["nombre"] if sub else None,
                "descripcion": r["descripcion"],
                "moneda": r["moneda"],
                "tasa": r["tasa"],
                "monto_orig": r["monto_orig"],
                "monto_base_usd": r["monto_base_usd"],
                "monto_pagado": r["monto_pagado"],
                "forma_pago": formas.get(r["forma_pago_id"]),
                "estado": r["estado"],
                "honorarios": r["honorarios"],
                "costo_total": r["costo_total"],
                "porcentaje_admin": r["porcentaje_admin"],
                "tasa_binance": r["tasa_binance"],
                "tasa_usada": r["tasa_usada"],
                "porcentaje_brecha_real": r["porcentaje_brecha_real"],
                "contrato_vinculado": None,
            }
        )

    conn.close()

    payload = {
        "proyecto_id": args.proyecto_id or None,
        "honorarios_admin_pct": args.honorarios,
        "devaluacion_pct": 0,
        "obra_alias": "FLAMBOYANT / CCO V4",
        "auto_vincular": not args.no_auto_vincular,
        "estructura": estructura,
        "transacciones": transacciones,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    clases: dict[str, int] = {}
    for t in transacciones:
        c = str(t["clase"] or "?")
        clases[c] = clases.get(c, 0) + 1

    print(f"OK -> {out.resolve()}")
    print(f"  estructura: {len(estructura)}")
    print(f"  transacciones: {len(transacciones)} {clases}")

    if args.post:
        if not args.proyecto_id:
            print("ERROR: --post requiere --proyecto-id", file=sys.stderr)
            return 1
        url = args.post.rstrip("/") + "/api/contabilidad/cco/import-v4"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = resp.read().decode("utf-8")
            print("POST", url, "→", resp.status)
            print(body[:2000])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
