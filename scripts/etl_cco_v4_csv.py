#!/usr/bin/env python3
"""
ETL: CSV export Antigravity/CCO V4 (RANCHO …) → JSON para POST /api/contabilidad/cco/import-v4

El CSV del suegro no trae columna id. Generamos origen_v4_id estable (huella SHA-256 → int)
para que reimportar el mismo CSV actualice y no duplique.

Uso:
  python scripts/etl_cco_v4_csv.py
  python scripts/etl_cco_v4_csv.py --csv "c:/Users/matal/Downloads/RANCHO 20072026.csv" --out tmp/cco_v4_from_csv.json
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def num(v: object) -> float | None:
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def fecha10(v: object) -> str | None:
    s = str(v or "").strip()
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return s or None


def norm(s: object) -> str:
    return " ".join(str(s or "").strip().upper().split())


def stable_origen_id(parts: list[str]) -> int:
    """Entero positivo estable (1..2e9) a partir de la huella de negocio."""
    h = hashlib.sha256("|".join(parts).encode("utf-8")).digest()
    n = int.from_bytes(h[:4], "big") % 2_000_000_000
    return n + 1


def col(row: dict[str, str], *names: str) -> str:
    lower = {k.lower().strip(): k for k in row}
    for n in names:
        k = lower.get(n.lower())
        if k is not None:
            return (row.get(k) or "").strip()
    return ""


def main() -> int:
    ap = argparse.ArgumentParser(description="Export CCO V4 CSV → JSON import payload")
    ap.add_argument(
        "--csv",
        default=r"c:\Users\matal\Downloads\RANCHO 20072026.csv",
        help="CSV exportado desde Antigravity",
    )
    ap.add_argument("--out", default="tmp/cco_v4_from_csv.json", help="JSON de salida")
    ap.add_argument("--proyecto-id", default="", help="UUID ci_proyectos destino")
    ap.add_argument("--honorarios", type=float, default=15.0)
    ap.add_argument("--obra-alias", default="RANCHO FLAMBOYANT")
    args = ap.parse_args()

    path = Path(args.csv)
    if not path.exists():
        print(f"ERROR: no existe {path}", file=sys.stderr)
        return 1

    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    # Contador de huellas para filas idénticas (mismo gasto repetido)
    occ: dict[str, int] = defaultdict(int)
    transacciones: list[dict] = []
    caps: dict[str, dict] = {}  # nombre_norm -> {id, nombre, tipo, padre}

    cap_id_seq = 0

    def ensure_cap(nombre: str, tipo: str, padre_nombre: str | None = None) -> int | None:
        nonlocal cap_id_seq
        n = norm(nombre)
        if not n:
            return None
        if n in caps:
            return caps[n]["origen_v4_id"]
        padre_id = None
        if padre_nombre and tipo == "SUBCAPITULO":
            padre_id = ensure_cap(padre_nombre, "CAPITULO")
        cap_id_seq += 1
        # IDs de estructura en rango alto para no chocar con SQLite viejo (1..3k)
        oid = 10_000_000 + cap_id_seq
        caps[n] = {
            "origen_v4_id": oid,
            "nombre": nombre.strip(),
            "tipo_nivel": tipo,
            "padre_origen_v4_id": padre_id,
        }
        return oid

    for r in rows:
        clase = col(r, "CLASE").upper() or "GASTO"
        fecha = fecha10(col(r, "FECHA"))
        proveedor = col(r, "PROVEEDOR")
        tipo = col(r, "TIPO")
        capitulo = col(r, "CAPITULO")
        subcapitulo = col(r, "SUBCAPITULO")
        descripcion = col(r, "DESCRIPCION")
        contrato_vinc = col(r, "CONTRATO_VINCULADO")
        moneda = (col(r, "MONEDA") or "USD").upper()
        tasa = num(col(r, "TASA"))
        monto_orig = num(col(r, "MONTO ORIG", "MONTO_ORIG"))
        monto_base = num(col(r, "MONTO BASE USD", "MONTO_BASE_USD"))
        monto_pagado = num(col(r, "MONTO PAGADO", "MONTO_PAGADO"))
        forma = col(r, "FORMA PAGO", "FORMA_PAGO")
        estado = col(r, "ESTADO")
        honorarios = num(col(r, "HONORARIOS"))
        costo_total = num(col(r, "COSTO TOTAL", "COSTO_TOTAL"))
        pct_admin = num(col(r, "% ADMIN", "PORCENTAJE_ADMIN", "ADMIN"))
        tasa_binance = num(col(r, "TASA BINANCE", "TASA_BINANCE"))
        tasa_usada = col(r, "TASA USADA", "TASA_USADA")
        brecha = num(col(r, "% BRECHA REAL", "PORCENTAJE_BRECHA_REAL"))

        if capitulo:
            ensure_cap(capitulo, "CAPITULO")
        if subcapitulo:
            ensure_cap(subcapitulo, "SUBCAPITULO", capitulo or None)

        fingerprint = "|".join(
            [
                clase,
                fecha or "",
                norm(proveedor),
                norm(tipo),
                norm(capitulo),
                norm(subcapitulo),
                norm(descripcion),
                moneda,
                f"{(monto_base or 0):.4f}",
                f"{(monto_orig or 0):.4f}",
                norm(estado),
            ]
        )
        n_occ = occ[fingerprint]
        occ[fingerprint] = n_occ + 1
        origen_v4_id = stable_origen_id([fingerprint, str(n_occ)])

        transacciones.append(
            {
                "origen_v4_id": origen_v4_id,
                "clase": clase,
                "fecha": fecha,
                "proveedor": proveedor or None,
                "tipo": tipo or None,
                "capitulo": capitulo or None,
                "subcapitulo": subcapitulo or None,
                "descripcion": descripcion or None,
                "moneda": moneda,
                "tasa": tasa,
                "monto_orig": monto_orig,
                "monto_base_usd": monto_base,
                "monto_pagado": monto_pagado,
                "forma_pago": forma or None,
                "estado": estado or None,
                "honorarios": honorarios,
                "costo_total": costo_total,
                "porcentaje_admin": pct_admin,
                "tasa_binance": tasa_binance,
                "tasa_usada": tasa_usada or None,
                "porcentaje_brecha_real": brecha,
                "contrato_vinculado": contrato_vinc or None,
            }
        )

    # Capítulos primero
    estructura = sorted(
        caps.values(),
        key=lambda x: (0 if x["tipo_nivel"] == "CAPITULO" else 1, x["origen_v4_id"]),
    )

    payload = {
        "proyecto_id": args.proyecto_id or None,
        "honorarios_admin_pct": args.honorarios,
        "devaluacion_pct": 0,
        "obra_alias": args.obra_alias,
        "auto_vincular": True,
        "estructura": estructura,
        "transacciones": transacciones,
        "fuente": "csv_antigravity",
        "archivo": path.name,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    clases = Counter(str(t["clase"]) for t in transacciones)
    print(f"OK -> {out.resolve()}")
    print(f"  estructura: {len(estructura)}")
    print(f"  transacciones: {len(transacciones)} {dict(clases)}")
    print(f"  huellas repetidas (occ>0): {sum(1 for v in occ.values() if v > 1)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
