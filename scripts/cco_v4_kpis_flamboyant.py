#!/usr/bin/env python3
"""
CCO V4 — KPIs financieros desde SQLite (Rancho Flamboyant / database_v4.db).

Replica la lógica oficial de ETL + totales BCV + conversión Real (Binance)
para validar al céntimo las métricas de control de obra.

Uso:
  python scripts/cco_v4_kpis_flamboyant.py
  python scripts/cco_v4_kpis_flamboyant.py --db "c:/Users/matal/Downloads/database_v4.db"
  python scripts/cco_v4_kpis_flamboyant.py --csv tmp/cco_v4_maestro.csv
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import pandas as pd

ADMIN_PCT_DEFAULT = 15.0

# Cifras oficiales de validación (maestro CCO V4 / Rancho Flamboyant).
EXPECTED = {
    "n_ingresos": 56,
    "n_gastos": 2297,
    "ingresos_bcv": 625_265.00,
    "gastos_netos_bcv": 565_952.44,
    "admin_bcv": 84_892.87,
    "costo_total_bcv": 650_845.31,
    "saldo_bcv": -25_580.31,
    "factor": 0.7437761141324109,
    "devaluacion_pct": -25.62239,
    "ingresos_real": 465_057.15,
    "gastos_real": 420_941.89,
    "admin_real": 63_141.28,
    "costo_real": 484_083.17,
    "saldo_real": -19_026.02,
}

# Columnas canónicas del SELECT maestro (alias de salida).
TEXT_COLS = [
    "CLASE",
    "PROVEEDOR",
    "TIPO",
    "CAPITULO",
    "SUBCAPITULO",
    "DESCRIPCION",
    "CONTRATO_VINCULADO",
    "MONEDA",
    "FORMA PAGO",
    "LINK FACTURA",
    "LINK COMPROBANTE",
    "ESTADO",
    "TASA USADA",
    "POOL_ASIGNADO",
]

NUM_COLS = [
    "MONTO ORIG",
    "MONTO BASE USD",
    "MONTO PAGADO",
    "HONORARIOS",
    "COSTO TOTAL",
    "% ADMIN",
    "TASA",
    "TASA BINANCE",
    "% BRECHA REAL",
    "AVANCE_FISICO",
]

NULLISH = {"NAN", "NONE", "NAT", "<NA>", "NULL"}

# Expresiones SQL en transacciones t → alias canónico.
# Si la columna no existe en SQLite, se proyecta NULL (mismo alias).
TX_COLUMN_MAP = {
    "CLASE": "t.clase",
    "FECHA": "t.fecha",
    "DESCRIPCION": "t.descripcion",
    "CONTRATO_VINCULADO": "t.contrato_vinculado",
    "MONEDA": "t.moneda",
    "TASA": "t.tasa",
    "MONTO ORIG": "t.monto_orig",
    "MONTO BASE USD": "t.monto_base_usd",
    "MONTO PAGADO": "t.monto_pagado",
    "LINK FACTURA": "t.link_factura",
    "LINK COMPROBANTE": "t.link_comprobante",
    "ESTADO": "t.estado",
    "HONORARIOS": "t.honorarios",
    "COSTO TOTAL": "t.costo_total",
    "% ADMIN": "t.porcentaje_admin",
    "TASA BINANCE": "t.tasa_binance",
    "TASA USADA": "t.tasa_usada",
    "% BRECHA REAL": "t.porcentaje_brecha_real",
    "POOL_ASIGNADO": "t.pool_asignado",
    "AVANCE_FISICO": "t.avance_fisico",
}


def round2(x: float) -> float:
    """Redondeo comercial half-up a 2 decimales (evita banker's rounding de round())."""
    d = Decimal(str(float(x))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(d)


def factor_descuento(ingresos_reales: float, ingresos_bcv: float) -> float:
    """FACTOR = ingresos_reales / ingresos_bcv usando decimales al céntimo."""
    num = Decimal(str(round2(ingresos_reales)))
    den = Decimal(str(round2(ingresos_bcv)))
    if den <= 0:
        return 1.0
    return float(num / den)


def sql_ident(alias: str) -> str:
    """Alias SQL con corchetes si tiene espacios o %."""
    if any(ch in alias for ch in (" ", "%")):
        return f"[{alias}]"
    return alias


def build_query(conn: sqlite3.Connection) -> str:
    """
    SELECT canónico del maestro V4. Usa columnas reales de `transacciones`
    cuando existen; si faltan (p. ej. contrato_vinculado), proyecta NULL AS alias.
    """
    cols = {
        row[1]
        for row in conn.execute("PRAGMA table_info(transacciones)").fetchall()
    }

    ordered = [
        ("CLASE", None),
        ("FECHA", None),
        ("PROVEEDOR", "p.nombre"),
        ("TIPO", "tg.nombre"),
        ("CAPITULO", "cap.nombre"),
        ("SUBCAPITULO", "subcap.nombre"),
        ("DESCRIPCION", None),
        ("CONTRATO_VINCULADO", None),
        ("MONEDA", None),
        ("TASA", None),
        ("MONTO ORIG", None),
        ("MONTO BASE USD", None),
        ("MONTO PAGADO", None),
        ("FORMA PAGO", "fp.nombre"),
        ("LINK FACTURA", None),
        ("LINK COMPROBANTE", None),
        ("ESTADO", None),
        ("HONORARIOS", None),
        ("COSTO TOTAL", None),
        ("% ADMIN", None),
        ("TASA BINANCE", None),
        ("TASA USADA", None),
        ("% BRECHA REAL", None),
        ("POOL_ASIGNADO", None),
        ("AVANCE_FISICO", None),
    ]

    lines: list[str] = []
    for alias, join_expr in ordered:
        if join_expr is not None:
            lines.append(f"    {join_expr} AS {sql_ident(alias)}")
            continue
        expr = TX_COLUMN_MAP[alias]
        col_name = expr.split(".", 1)[1]
        if col_name in cols:
            lines.append(f"    {expr} AS {sql_ident(alias)}")
        else:
            lines.append(f"    NULL AS {sql_ident(alias)}")

    return (
        "SELECT\n"
        + ",\n".join(lines)
        + """
FROM transacciones t
LEFT JOIN proveedores p ON t.proveedor_id = p.id
LEFT JOIN tipos_gasto tg ON t.tipo_gasto_id = tg.id
LEFT JOIN estructura_costos cap ON t.capitulo_id = cap.id
LEFT JOIN estructura_costos subcap ON t.subcapitulo_id = subcap.id
LEFT JOIN formas_pago fp ON t.forma_pago_id = fp.id
"""
    )


def load_dataframe(db_path: Path) -> pd.DataFrame:
    conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    try:
        query = build_query(conn)
        df = pd.read_sql_query(query, conn)
    finally:
        conn.close()
    return df


def ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in TEXT_COLS:
        if col not in out.columns:
            out[col] = "BCV" if col == "TASA USADA" else ""
    if "FECHA" not in out.columns:
        out["FECHA"] = pd.NaT
    for col in NUM_COLS:
        if col not in out.columns:
            out[col] = 0.0
    if "TASA USADA" in out.columns:
        out["TASA USADA"] = out["TASA USADA"].fillna("BCV")
    return out


def clean_text(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in TEXT_COLS:
        if col not in out.columns:
            continue
        s = out[col].astype(str).str.strip().str.upper()
        s = s.where(~s.isin(NULLISH), "")
        out[col] = s
    return out


def coerce_numeric(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in NUM_COLS:
        if col not in out.columns:
            out[col] = 0.0
            continue
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0).astype(float)
    return out


def parse_fecha(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["FECHA"] = pd.to_datetime(out["FECHA"], errors="coerce")
    return out


def apply_derived(df: pd.DataFrame, admin_default: float = ADMIN_PCT_DEFAULT) -> pd.DataFrame:
    """Recalcula columnas derivadas fila a fila (lógica CCO V4)."""
    out = df.copy()

    moneda = out["MONEDA"].fillna("").astype(str).str.strip().str.upper()
    monto_orig = out["MONTO ORIG"].astype(float)
    tasa = out["TASA"].astype(float)

    # MONTO BASE USD
    base = monto_orig.copy()
    mask_fx = ~moneda.isin(["USD", ""]) & (tasa > 0)
    base = base.where(~mask_fx, monto_orig / tasa)
    out["MONTO BASE USD"] = base.astype(float)

    clase = out["CLASE"].fillna("").astype(str).str.strip().str.upper()
    pct_admin = out["% ADMIN"].astype(float)
    pct_eff = pct_admin.where(pct_admin > 0, float(admin_default))

    honorarios = pd.Series(0.0, index=out.index, dtype=float)
    costo = out["MONTO BASE USD"].astype(float).copy()

    is_gasto = clase == "GASTO"
    is_ingreso = clase == "INGRESO"

    honorarios = honorarios.where(
        ~is_gasto,
        out["MONTO BASE USD"] * (pct_eff / 100.0),
    )
    costo = costo.where(~is_gasto, out["MONTO BASE USD"] + honorarios)
    honorarios = honorarios.where(~is_ingreso, 0.0)
    costo = costo.where(~is_ingreso, out["MONTO BASE USD"])

    out["HONORARIOS"] = honorarios.astype(float)
    out["COSTO TOTAL"] = costo.astype(float)

    estado = out["ESTADO"].fillna("").astype(str).str.strip().str.upper()
    out["MONTO PAGADO"] = out["MONTO BASE USD"].where(estado == "PAGADO", 0.0).astype(float)

    return out


def ingreso_real_usd(row: pd.Series) -> float:
    moneda = str(row.get("MONEDA") or "").strip().upper()
    monto_orig = float(row.get("MONTO ORIG") or 0.0)
    if moneda in ("USD", ""):
        return monto_orig
    tasa_bin = float(row.get("TASA BINANCE") or 0.0)
    tasa = float(row.get("TASA") or 0.0)
    tasa_real = tasa_bin if tasa_bin > 0 else tasa
    if tasa_real > 0:
        return monto_orig / tasa_real
    return monto_orig


def compute_kpis(df: pd.DataFrame) -> dict[str, float | int]:
    """
    KPIs solo sobre CLASE INGRESO / GASTO.
    Excluye CONTRATO y AUDITORIA (y cualquier otra clase).
    """
    clase = df["CLASE"].fillna("").astype(str).str.strip().str.upper()
    ingresos = df.loc[clase == "INGRESO"].copy()
    gastos = df.loc[clase == "GASTO"].copy()

    total_ingresos = float(ingresos["MONTO BASE USD"].sum())
    gastos_netos = float(gastos["MONTO BASE USD"].sum())
    admin = float(gastos["HONORARIOS"].sum())
    costo_total = float(gastos["COSTO TOTAL"].sum())
    saldo = total_ingresos - costo_total

    estado_g = gastos["ESTADO"].fillna("").astype(str).str.strip().str.upper()
    deuda = float(gastos.loc[estado_g == "PENDIENTE", "COSTO TOTAL"].sum())

    total_ingresos_reales = float(ingresos.apply(ingreso_real_usd, axis=1).sum())

    # Factor desde totales al céntimo con Decimal (evita error binario de float).
    factor = factor_descuento(total_ingresos_reales, total_ingresos)
    devaluacion_pct = (factor - 1.0) * 100.0

    gastos_real = gastos_netos * factor
    admin_real = admin * factor
    costo_real = costo_total * factor
    saldo_real = round2(total_ingresos_reales) - round2(costo_real)

    return {
        "n_ingresos": int(len(ingresos)),
        "n_gastos": int(len(gastos)),
        "ingresos_bcv": total_ingresos,
        "gastos_netos_bcv": gastos_netos,
        "admin_bcv": admin,
        "costo_total_bcv": costo_total,
        "saldo_bcv": saldo,
        "deuda_pendiente": deuda,
        "factor": factor,
        "devaluacion_pct": devaluacion_pct,
        "ingresos_real": total_ingresos_reales,
        "gastos_real": gastos_real,
        "admin_real": admin_real,
        "costo_real": costo_real,
        "saldo_real": saldo_real,
        "n_contrato": int((clase == "CONTRATO").sum()),
        "n_auditoria": int((clase == "AUDITORIA").sum()),
        "n_presupuesto": int((clase == "PRESUPUESTO").sum()),
    }


def fmt_usd(n: float) -> str:
    sign = "-" if n < 0 else ""
    return f"{sign}$ {abs(n):,.2f}"


def print_report(kpis: dict[str, float | int]) -> None:
    print("=" * 64)
    print("CCO V4 — Rancho Flamboyant (KPIs desde SQLite)")
    print("=" * 64)
    print()
    print("--- Inventario de clases (exclusiones) ---")
    print(f"  CONTRATO (excluido KPI):   {kpis['n_contrato']}")
    print(f"  AUDITORIA (excluido KPI):  {kpis['n_auditoria']}")
    print(f"  PRESUPUESTO (excluido):    {kpis['n_presupuesto']}")
    print()
    print("--- A. Totales Oficiales (Tasa BCV) ---")
    print(f"  Ingresos:        {kpis['n_ingresos']:>6} regs   {fmt_usd(round2(kpis['ingresos_bcv']))}")
    print(f"  Gastos netos:    {kpis['n_gastos']:>6} regs   {fmt_usd(round2(kpis['gastos_netos_bcv']))}")
    print(f"  Admin delegada:                 {fmt_usd(round2(kpis['admin_bcv']))}")
    print(f"  Costo total:                    {fmt_usd(round2(kpis['costo_total_bcv']))}")
    print(f"  Saldo en caja:                  {fmt_usd(round2(kpis['saldo_bcv']))}")
    print(f"  Deuda pendiente:                {fmt_usd(round2(kpis['deuda_pendiente']))}")
    print()
    print("--- B. Conversion Real (Binance) ---")
    print(f"  Factor descuento:               {kpis['factor']:.16f}")
    print(f"  Devaluacion promedio:           {kpis['devaluacion_pct']:.5f}%")
    print(f"  Ingresos reales:                {fmt_usd(round2(kpis['ingresos_real']))}")
    print(f"  Gastos reales:                  {fmt_usd(round2(kpis['gastos_real']))}")
    print(f"  Admin real:                     {fmt_usd(round2(kpis['admin_real']))}")
    print(f"  Costo real:                     {fmt_usd(round2(kpis['costo_real']))}")
    print(f"  Saldo real:                     {fmt_usd(round2(kpis['saldo_real']))}")
    print()


def validate(kpis: dict[str, float | int], tol_cent: float = 0.005, tol_factor: float = 1e-7) -> bool:
    checks: list[tuple[str, float | int, float | int, float]] = [
        ("n_ingresos", kpis["n_ingresos"], EXPECTED["n_ingresos"], 0),
        ("n_gastos", kpis["n_gastos"], EXPECTED["n_gastos"], 0),
        ("ingresos_bcv", round2(kpis["ingresos_bcv"]), EXPECTED["ingresos_bcv"], tol_cent),
        ("gastos_netos_bcv", round2(kpis["gastos_netos_bcv"]), EXPECTED["gastos_netos_bcv"], tol_cent),
        ("admin_bcv", round2(kpis["admin_bcv"]), EXPECTED["admin_bcv"], tol_cent),
        ("costo_total_bcv", round2(kpis["costo_total_bcv"]), EXPECTED["costo_total_bcv"], tol_cent),
        ("saldo_bcv", round2(kpis["saldo_bcv"]), EXPECTED["saldo_bcv"], tol_cent),
        ("factor", float(kpis["factor"]), EXPECTED["factor"], tol_factor),
        ("devaluacion_pct", round(float(kpis["devaluacion_pct"]), 5), EXPECTED["devaluacion_pct"], 1e-5),
        ("ingresos_real", round2(kpis["ingresos_real"]), EXPECTED["ingresos_real"], tol_cent),
        ("gastos_real", round2(kpis["gastos_real"]), EXPECTED["gastos_real"], tol_cent),
        ("admin_real", round2(kpis["admin_real"]), EXPECTED["admin_real"], tol_cent),
        ("costo_real", round2(kpis["costo_real"]), EXPECTED["costo_real"], tol_cent),
        ("saldo_real", round2(kpis["saldo_real"]), EXPECTED["saldo_real"], tol_cent),
    ]

    ok = True
    print("--- Validacion vs cifras oficiales ---")
    for name, got, exp, tol in checks:
        diff = abs(float(got) - float(exp))
        passed = diff <= tol
        mark = "OK" if passed else "FAIL"
        if not passed:
            ok = False
        print(f"  [{mark}] {name}: got={got} expected={exp} diff={diff}")
    print()
    if ok:
        print("RESULTADO: PASS — cifras coinciden al centimo")
    else:
        print("RESULTADO: FAIL — revisar logica/datos")
        if int(kpis["n_gastos"]) != int(EXPECTED["n_gastos"]):
            gap_n = int(EXPECTED["n_gastos"]) - int(kpis["n_gastos"])
            gap_usd = round2(EXPECTED["gastos_netos_bcv"] - round2(kpis["gastos_netos_bcv"]))
            print(
                f"  Nota: esta SQLite tiene {kpis['n_gastos']} GASTO "
                f"(faltan {gap_n} regs / {fmt_usd(gap_usd)} netos vs maestro oficial). "
                "Ingresos/factor ya cuadran; actualiza database_v4.db o aporta el dump con los 40 gastos."
            )
    return ok


def run(db_path: Path, admin_default: float = ADMIN_PCT_DEFAULT, csv_out: Path | None = None) -> int:
    if not db_path.exists():
        print(f"ERROR: no existe {db_path}", file=sys.stderr)
        return 1

    df = load_dataframe(db_path)
    df = ensure_columns(df)
    df = clean_text(df)
    df = coerce_numeric(df)
    df = parse_fecha(df)
    df = apply_derived(df, admin_default=admin_default)

    if csv_out is not None:
        csv_out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(csv_out, index=False, encoding="utf-8-sig")
        print(f"CSV maestro -> {csv_out.resolve()}")

    kpis = compute_kpis(df)
    print_report(kpis)
    passed = validate(kpis)
    return 0 if passed else 2


def main() -> int:
    ap = argparse.ArgumentParser(
        description="KPIs CCO V4 desde database_v4.db (Rancho Flamboyant)",
    )
    ap.add_argument(
        "--db",
        default=r"c:\Users\matal\Downloads\database_v4.db",
        help="Ruta a database_v4.db",
    )
    ap.add_argument(
        "--admin-pct",
        type=float,
        default=ADMIN_PCT_DEFAULT,
        help="% admin global por defecto si %% ADMIN es 0 (default 15)",
    )
    ap.add_argument(
        "--csv",
        default="",
        help="Ruta opcional para exportar el DataFrame procesado a CSV",
    )
    args = ap.parse_args()
    csv_out = Path(args.csv) if args.csv else None
    return run(Path(args.db), admin_default=args.admin_pct, csv_out=csv_out)


if __name__ == "__main__":
    raise SystemExit(main())
