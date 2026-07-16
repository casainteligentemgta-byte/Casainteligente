#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recibos de pago semanal (viernes) — construcción, ingreso integral referencial 100 USD.

Uso:
  pip install -r requirements.txt
  python recibo_pago_integral.py --tasa-bcv 55.42 --csv trabajadores_ejemplo.csv --out ./recibos
  python recibo_pago_integral.py --tasa-bcv 55.42 --json entrada_ejemplo.json --out ./recibos
  type entrada_ejemplo.json | python recibo_pago_integral.py --stdin-json --out ./recibos

Servicio HTTP mínimo (POST /generar con JSON): 1 trabajador -> PDF; varios -> ZIP.
  python recibo_pago_integral.py serve --port 8765
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

from fpdf import FPDF

# --- Constantes de negocio (Venezuela / caso tabulador indicado) ---
EMPRESA_RAZON = "CONSTRUCTORA ANTICA, C.A."
SALARIO_DIARIO_TABULADOR_BS = Decimal("805.60")
DIAS_SALARIO_BASE = Decimal("6")  # 5 laborados + 1 séptimo día (descanso remunerado)
TASA_SSO = Decimal("0.04")
TASA_SPF = Decimal("0.005")
TASA_FAOV = Decimal("0.01")
USD_META_INTEGRAL = Decimal("100")
USD_CESTA_TICKET = Decimal("10")

Q2 = Decimal("0.01")

_SCRIPT_DIR = Path(__file__).resolve().parent
_FONT_CACHE = _SCRIPT_DIR / "_fonts"
DEJAVU_SANS_URL = (
    "https://raw.githubusercontent.com/py-pdf/fpdf2/2.8.4/test/fonts/DejaVuSans.ttf"
)
DEJAVU_SANS_BOLD_URL = (
    "https://raw.githubusercontent.com/py-pdf/fpdf2/2.8.4/test/fonts/DejaVuSans-Bold.ttf"
)


def _ensure_ttf(url: str, dest: Path) -> None:
    if dest.is_file() and dest.stat().st_size > 10_000:
        return
    _FONT_CACHE.mkdir(parents=True, exist_ok=True)
    import urllib.request

    dest_part = dest.with_suffix(dest.suffix + ".part")
    try:
        urllib.request.urlretrieve(url, dest_part)
    except OSError as e:
        raise FileNotFoundError(
            f"No se pudo descargar la fuente desde {url}. "
            f"Conecte a Internet o copie manualmente el TTF en {dest}."
        ) from e
    dest_part.replace(dest)


def _font_path_dejavu(name: str) -> str:
    if name == "DejaVuSans.ttf":
        dest = _FONT_CACHE / "DejaVuSans.ttf"
        _ensure_ttf(DEJAVU_SANS_URL, dest)
        return str(dest)
    if name == "DejaVuSans-Bold.ttf":
        dest = _FONT_CACHE / "DejaVuSans-Bold.ttf"
        _ensure_ttf(DEJAVU_SANS_BOLD_URL, dest)
        return str(dest)
    raise ValueError(name)


def dec(x: str | float | int | Decimal) -> Decimal:
    if isinstance(x, Decimal):
        return x
    return Decimal(str(x))


def fmt_bs(v: Decimal) -> str:
    s = str(v.quantize(Q2, rounding=ROUND_HALF_UP))
    ent, _, frac = s.partition(".")
    ent_g = f"{int(ent):,}".replace(",", ".")
    return f"{ent_g},{frac}"


def fmt_usd(v: Decimal) -> str:
    return str(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)).replace(".", ",")


def slug_cedula(ced: str) -> str:
    t = re.sub(r"[^\w\-]+", "_", ced.strip(), flags=re.UNICODE).strip("_")
    t = t.replace("/", "_").replace("\\", "_")
    return (t[:40] if t else "sin_cedula")


@dataclass(frozen=True)
class LineasRecibo:
    tasa_bcv: Decimal
    fecha_pago: date
    salario_bruto_tab_bs: Decimal
    sso_bs: Decimal
    spf_bs: Decimal
    faov_bs: Decimal
    total_deducciones_ley_bs: Decimal
    salario_neto_tab_bs: Decimal
    equivalente_100_usd_bs: Decimal
    cesta_ticket_bs: Decimal
    bono_especial_art105_bs: Decimal
    total_neto_pagado_bs: Decimal


def calcular_lineas(tasa_bcv: Decimal) -> LineasRecibo:
    if tasa_bcv <= 0:
        raise ValueError("La tasa BCV debe ser mayor que cero.")

    salario_bruto = (SALARIO_DIARIO_TABULADOR_BS * DIAS_SALARIO_BASE).quantize(Q2, rounding=ROUND_HALF_UP)
    sso = (salario_bruto * TASA_SSO).quantize(Q2, rounding=ROUND_HALF_UP)
    spf = (salario_bruto * TASA_SPF).quantize(Q2, rounding=ROUND_HALF_UP)
    faov = (salario_bruto * TASA_FAOV).quantize(Q2, rounding=ROUND_HALF_UP)
    total_ded = (sso + spf + faov).quantize(Q2, rounding=ROUND_HALF_UP)
    neto_tab = (salario_bruto - total_ded).quantize(Q2, rounding=ROUND_HALF_UP)

    eq100 = (USD_META_INTEGRAL * tasa_bcv).quantize(Q2, rounding=ROUND_HALF_UP)
    cesta = (USD_CESTA_TICKET * tasa_bcv).quantize(Q2, rounding=ROUND_HALF_UP)
    bono = (eq100 - neto_tab - cesta).quantize(Q2, rounding=ROUND_HALF_UP)

    if bono < 0:
        raise ValueError(
            f"Bono especial negativo ({fmt_bs(bono)} Bs). "
            "Revise la tasa BCV o los parámetros: con esta tasa no alcanza "
            "100 USD netos de sobre con tabulador + cesta + deducciones de ley."
        )

    total_neto = (neto_tab + cesta + bono).quantize(Q2, rounding=ROUND_HALF_UP)
    return LineasRecibo(
        tasa_bcv=tasa_bcv,
        fecha_pago=date.today(),
        salario_bruto_tab_bs=salario_bruto,
        sso_bs=sso,
        spf_bs=spf,
        faov_bs=faov,
        total_deducciones_ley_bs=total_ded,
        salario_neto_tab_bs=neto_tab,
        equivalente_100_usd_bs=eq100,
        cesta_ticket_bs=cesta,
        bono_especial_art105_bs=bono,
        total_neto_pagado_bs=total_neto,
    )


def calcular_lineas_con_fecha(tasa_bcv: Decimal, fecha: date) -> LineasRecibo:
    base = calcular_lineas(tasa_bcv)
    return LineasRecibo(
        tasa_bcv=base.tasa_bcv,
        fecha_pago=fecha,
        salario_bruto_tab_bs=base.salario_bruto_tab_bs,
        sso_bs=base.sso_bs,
        spf_bs=base.spf_bs,
        faov_bs=base.faov_bs,
        total_deducciones_ley_bs=base.total_deducciones_ley_bs,
        salario_neto_tab_bs=base.salario_neto_tab_bs,
        equivalente_100_usd_bs=base.equivalente_100_usd_bs,
        cesta_ticket_bs=base.cesta_ticket_bs,
        bono_especial_art105_bs=base.bono_especial_art105_bs,
        total_neto_pagado_bs=base.total_neto_pagado_bs,
    )


class ReciboPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(format="Letter", unit="mm")
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("DejaVu", "", fname=_font_path_dejavu("DejaVuSans.ttf"))
        self.add_font("DejaVu", "B", fname=_font_path_dejavu("DejaVuSans-Bold.ttf"))
        self.set_font("DejaVu", "", 9)


def generar_pdf(
    *,
    nombre: str,
    cedula: str,
    cargo: str,
    lineas: LineasRecibo,
) -> bytes:
    pdf = ReciboPDF()
    pdf.add_page()
    pdf.set_font("DejaVu", "B", 14)
    pdf.multi_cell(0, 8, EMPRESA_RAZON, align="C")
    pdf.ln(2)
    pdf.set_font("DejaVu", "B", 11)
    pdf.cell(0, 7, "RECIBO DE PAGO SEMANAL (CONSTRUCCIÓN)", ln=1, align="C")
    pdf.set_font("DejaVu", "", 9)
    fp = lineas.fecha_pago.strftime("%d/%m/%Y")
    pdf.cell(0, 6, f"Fecha de pago (viernes): {fp}", ln=1, align="C")
    pdf.cell(0, 6, f"Tasa oficial BCV del día: {fmt_bs(lineas.tasa_bcv)} Bs. por USD", ln=1, align="C")
    pdf.ln(4)

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(0, 6, "Datos del trabajador", ln=1)
    pdf.set_font("DejaVu", "", 9)
    pdf.cell(0, 6, f"Nombre: {nombre}", ln=1)
    pdf.cell(0, 6, f"Cédula: {cedula}", ln=1)
    pdf.cell(0, 6, f"Cargo: {cargo}", ln=1)
    pdf.ln(2)

    def fila(concepto: str, monto: str, bold: bool = False) -> None:
        pdf.set_font("DejaVu", "B" if bold else "", 9)
        pdf.cell(120, 6, concepto, border=1)
        pdf.cell(0, 6, monto, border=1, align="R", ln=1)

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(0, 7, "I. Conceptos salariales (base legal — tabulador)", ln=1)
    pdf.ln(1)
    fila(
        f"Salario tabulador ({DIAS_SALARIO_BASE} días: 5 laborados + 1 día de descanso) — {fmt_bs(SALARIO_DIARIO_TABULADOR_BS)} Bs/día",
        f"{fmt_bs(lineas.salario_bruto_tab_bs)} Bs.",
    )
    pdf.set_font("DejaVu", "B", 9)
    pdf.cell(120, 6, "Deducciones de ley (solo sobre salario tabulador)", border=1)
    pdf.cell(0, 6, "", border=1, ln=1)
    pdf.set_font("DejaVu", "", 9)
    fila("  SSO (4%)", f"- {fmt_bs(lineas.sso_bs)} Bs.")
    fila("  SPF (0,5%)", f"- {fmt_bs(lineas.spf_bs)} Bs.")
    fila("  FAOV (1%)", f"- {fmt_bs(lineas.faov_bs)} Bs.")
    fila("Total deducciones de ley", f"- {fmt_bs(lineas.total_deducciones_ley_bs)} Bs.", bold=True)
    fila("Salario tabulador neto", f"{fmt_bs(lineas.salario_neto_tab_bs)} Bs.", bold=True)
    pdf.ln(3)

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(0, 7, "II. Conceptos no salariales / complemento (referencia 100 USD integral)", ln=1)
    pdf.ln(1)
    pdf.set_font("DejaVu", "", 9)
    fila(
        f"Cesta Ticket (indexado) — {fmt_usd(USD_CESTA_TICKET)} USD × {fmt_bs(lineas.tasa_bcv)} Bs/USD",
        f"{fmt_bs(lineas.cesta_ticket_bs)} Bs.",
    )
    fila(
        "Bono Especial de Complemento (Art. 105 LOTTT — no salarial)",
        f"{fmt_bs(lineas.bono_especial_art105_bs)} Bs.",
    )
    pdf.ln(2)

    pdf.set_font("DejaVu", "B", 9)
    fila(
        f"Total neto pagado al trabajador (equivalente referencial {fmt_usd(USD_META_INTEGRAL)} USD a tasa del día)",
        f"{fmt_bs(lineas.total_neto_pagado_bs)} Bs.",
        bold=True,
    )
    pdf.ln(3)

    pdf.set_font("DejaVu", "I", 8.5)
    pdf.multi_cell(
        0,
        4.5,
        "Transporte gratuito Jorge Coll — Obra (beneficio social no remunerativo, Art. 105 LOTTT). "
        "Línea informativa: no forma parte del salario ni de la base de cálculo de prestaciones.",
    )
    pdf.ln(6)

    pdf.set_font("DejaVu", "", 9)
    pdf.cell(95, 6, "Firma del trabajador", border=0)
    pdf.cell(0, 6, "Firma y sello — RRHH / Pagos", border=0, ln=1)
    pdf.ln(10)
    y_box = pdf.get_y()
    pdf.rect(10, y_box, 88, 18)
    pdf.rect(108, y_box, 88, 18)
    pdf.ln(20)
    pdf.set_font("DejaVu", "", 8)
    pdf.cell(88, 5, "Huella dactilar", align="C", border=0)
    pdf.cell(20, 5, "", border=0)
    pdf.cell(88, 5, "", align="C", border=0, ln=1)
    pdf.ln(10)

    pdf.set_font("DejaVu", "", 7.5)
    nota = (
        "Nota legal: El trabajador declara haber recibido a su entera satisfacción la suma indicada, "
        "sin perjuicio de la irrenunciabilidad de los derechos laborales que le correspondan conforme a la ley. "
        "La percepción del beneficio de transporte gratuito se entiende aceptada en los términos acordados "
        "con la empresa, reconociendo su carácter no remunerativo y no salarial."
    )
    pdf.multi_cell(0, 3.8, nota)

    out = pdf.output(dest="S")
    return out if isinstance(out, (bytes, bytearray)) else out.encode("latin-1")


def leer_trabajadores_csv(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        for row in r:
            nombre = (row.get("nombre") or row.get("Nombre") or "").strip()
            cedula = (row.get("cedula") or row.get("Cédula") or row.get("CI") or "").strip()
            cargo = (row.get("cargo") or row.get("Cargo") or "").strip()
            if nombre:
                rows.append({"nombre": nombre, "cedula": cedula or "-", "cargo": cargo or "-"})
    return rows


def parse_fecha(s: str | None) -> date:
    if not s or not str(s).strip():
        return date.today()
    t = str(s).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(t, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Fecha no válida: {s!r}. Use YYYY-MM-DD o DD/MM/YYYY.")


def cmd_generar(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    tasa: Decimal | None = dec(args.tasa_bcv) if args.tasa_bcv else None
    fecha = parse_fecha(args.fecha)

    trabajadores: list[dict[str, str]] = []
    if args.stdin_json:
        raw = sys.stdin.read()
        data = json.loads(raw)
        if data.get("tasa_bcv") is not None:
            tasa = dec(data["tasa_bcv"])
        if data.get("fecha_pago") or data.get("fecha"):
            fecha = parse_fecha(data.get("fecha_pago") or data.get("fecha"))
        trabajadores = list(data.get("trabajadores") or [])
    elif args.json:
        data = json.loads(Path(args.json).read_text(encoding="utf-8"))
        if data.get("tasa_bcv") is not None:
            tasa = dec(data["tasa_bcv"])
        if data.get("fecha_pago") or data.get("fecha"):
            fecha = parse_fecha(data.get("fecha_pago") or data.get("fecha"))
        trabajadores = [dict(x) for x in data.get("trabajadores") or []]
    elif args.csv:
        trabajadores = leer_trabajadores_csv(Path(args.csv))
    else:
        print("Indique --csv, --json o --stdin-json.", file=sys.stderr)
        return 2

    if tasa is None:
        print("Falta la tasa BCV: use --tasa-bcv o incluya tasa_bcv en el JSON.", file=sys.stderr)
        return 2

    if not trabajadores:
        print("No hay trabajadores en la entrada.", file=sys.stderr)
        return 2

    try:
        lineas = calcular_lineas_con_fecha(tasa, fecha)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1
    fp_str = fecha.isoformat()

    for t in trabajadores:
        nombre = str(t.get("nombre", "")).strip()
        cedula = str(t.get("cedula", "")).strip()
        cargo = str(t.get("cargo", "")).strip()
        if not nombre:
            continue
        pdf_bytes = generar_pdf(nombre=nombre, cedula=cedula or "-", cargo=cargo or "-", lineas=lineas)
        fn = out_dir / f"recibo_{slug_cedula(cedula)}_{fp_str}.pdf"
        fn.write_bytes(pdf_bytes)
        print(fn.resolve())

    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *a) -> None:
            sys.stderr.write(f"{self.address_string()} - {fmt % a}\n")

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path not in ("/generar", "/"):
                self.send_error(404)
                return
            ln = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(ln) if ln > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error":"JSON invalido"}')
                return
            try:
                tasa = dec(data["tasa_bcv"])
                fecha = parse_fecha(data.get("fecha_pago") or data.get("fecha"))
                lista = list(data.get("trabajadores") or [])
                if not lista:
                    raise ValueError("trabajadores vacio")
            except (KeyError, ValueError) as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

            lineas = calcular_lineas_con_fecha(tasa, fecha)
            fp_str = fecha.isoformat()
            archivos: list[str] = []

            if len(lista) == 1:
                t = lista[0]
                nombre = str(t.get("nombre", "")).strip()
                cedula = str(t.get("cedula", "")).strip()
                cargo = str(t.get("cargo", "")).strip()
                try:
                    pdf_bytes = generar_pdf(
                        nombre=nombre or "-",
                        cedula=cedula or "-",
                        cargo=cargo or "-",
                        lineas=lineas,
                    )
                except ValueError as e:
                    self.send_response(422)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header(
                    "Content-Disposition",
                    f'attachment; filename="recibo_{slug_cedula(cedula)}_{fp_str}.pdf"',
                )
                self.end_headers()
                self.wfile.write(pdf_bytes)
                return

            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for t in lista:
                    nombre = str(t.get("nombre", "")).strip()
                    cedula = str(t.get("cedula", "")).strip()
                    cargo = str(t.get("cargo", "")).strip()
                    if not nombre:
                        continue
                    try:
                        pdf_bytes = generar_pdf(
                            nombre=nombre,
                            cedula=cedula or "-",
                            cargo=cargo or "-",
                            lineas=lineas,
                        )
                    except ValueError as e:
                        self.send_response(422)
                        self.send_header("Content-Type", "application/json; charset=utf-8")
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                        return
                    nm = f"recibo_{slug_cedula(cedula)}_{fp_str}.pdf"
                    zf.writestr(nm, pdf_bytes)
                    archivos.append(nm)

            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f'attachment; filename="recibos_{fp_str}.zip"')
            self.end_headers()
            self.wfile.write(buf.getvalue())

        def do_GET(self) -> None:
            msg = (
                '{"servicio":"recibos_nomina_ve","uso":"POST /generar con JSON '
                '{tasa_bcv, fecha_pago?, trabajadores:[{nombre,cedula,cargo}]}'
                ' — 1 trabajador: PDF; varios: ZIP."}'
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(msg.encode("utf-8"))

    httpd = HTTPServer((args.host, args.port), Handler)
    print(f"Escuchando en http://{args.host}:{args.port}  POST /generar  (Ctrl+C para salir)", file=sys.stderr)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Recibos de pago — ingreso integral 100 USD (referencia BCV).")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generar", help="Generar PDFs desde CSV o JSON")
    g.add_argument("--tasa-bcv", type=str, default=None, help="Bs por USD (obligatoria con --csv; puede ir en JSON)")
    g.add_argument("--fecha", type=str, default=None, help="Fecha del recibo (YYYY-MM-DD). Por defecto hoy.")
    g.add_argument("--out", type=str, default="./recibos_generados", help="Carpeta de salida")
    g.add_argument("--csv", type=str, default=None, help="Archivo CSV (columnas: nombre, cedula, cargo)")
    g.add_argument("--json", type=str, default=None, help="Archivo JSON con tasa_bcv, fecha_pago, trabajadores")
    g.add_argument("--stdin-json", action="store_true", help="Leer JSON completo desde stdin (integración / API)")
    g.set_defaults(func=cmd_generar)

    s = sub.add_parser("serve", help="API HTTP mínima (POST JSON → PDF o ZIP)")
    s.add_argument("--host", type=str, default="127.0.0.1")
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--out", type=str, default="./recibos_generados", help="(reservado; salida por respuesta HTTP)")
    s.set_defaults(func=cmd_serve)

    args = p.parse_args()
    if args.cmd == "generar":
        if not args.stdin_json and not args.json and not args.csv:
            p.error("generar requiere --csv, --json o --stdin-json")
        if args.csv and not args.tasa_bcv:
            p.error("generar con --csv requiere --tasa-bcv")

    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
