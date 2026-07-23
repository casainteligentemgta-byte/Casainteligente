#!/usr/bin/env python3
"""
LaborCalculator — Art. 142 LOTTT (determinístico / auditable).

  python scripts/legal/calcular_prestacion_antiguedad.py --salario 500
  python scripts/legal/calcular_prestacion_antiguedad.py --salario 500 \\
    --inicio 2020-01-15 --fin 2026-07-16
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from typing import Any, Dict, Optional, Union

try:
    from dateutil.relativedelta import relativedelta
except ImportError as e:
    raise SystemExit("Instale python-dateutil: pip install python-dateutil") from e

DateLike = Union[date, datetime, str]

LOTTT_MIN_DIAS_UTILIDADES = 30
LOTTT_MIN_DIAS_BONO = 15
VERSION_FORMULA = "1.1.0"


def _parse_date(value: DateLike) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def anios_servicio_computables(diff: relativedelta) -> tuple[int, bool]:
    """Fracción superior a seis meses: 6 meses + ≥1 día cuenta como año adicional."""
    fraccion = diff.months > 6 or (diff.months == 6 and diff.days > 0)
    return diff.years + (1 if fraccion else 0), fraccion


class LaborCalculator:
    def __init__(
        self,
        salario_base_mensual: float,
        dias_utilidades: int = LOTTT_MIN_DIAS_UTILIDADES,
        dias_bono_vacacional: int = LOTTT_MIN_DIAS_BONO,
        *,
        dias_base_anual: int = 360,
        dias_garantia_trimestral: int = 15,
        dias_retroactivo_por_anio: int = 60,
    ):
        if salario_base_mensual < 0:
            raise ValueError("salario_base_mensual debe ser >= 0")
        self.salario_base_mensual = float(salario_base_mensual)
        self.dias_utilidades = dias_utilidades
        self.dias_bono_vacacional = dias_bono_vacacional
        self.dias_base_anual = dias_base_anual
        self.dias_garantia_trimestral = dias_garantia_trimestral
        self.dias_retroactivo_por_anio = dias_retroactivo_por_anio

    def get_salario_integral_diario(self) -> float:
        salario_diario_normal = self.salario_base_mensual / 30
        alicuota_utilidades = (salario_diario_normal * self.dias_utilidades) / self.dias_base_anual
        alicuota_bono = (salario_diario_normal * self.dias_bono_vacacional) / self.dias_base_anual
        return salario_diario_normal + alicuota_utilidades + alicuota_bono

    def calcular_garantia_trimestral(self) -> float:
        return self.get_salario_integral_diario() * self.dias_garantia_trimestral

    def calcular_retroactivo(self, fecha_inicio: DateLike, fecha_fin: DateLike) -> float:
        inicio = _parse_date(fecha_inicio)
        fin = _parse_date(fecha_fin)
        if fin < inicio:
            raise ValueError("fecha_fin debe ser >= fecha_inicio")
        diff = relativedelta(fin, inicio)
        anios, _ = anios_servicio_computables(diff)
        return self.get_salario_integral_diario() * self.dias_retroactivo_por_anio * anios

    def to_dict(
        self,
        fecha_inicio: Optional[DateLike] = None,
        fecha_fin: Optional[DateLike] = None,
    ) -> Dict[str, Any]:
        sid = self.get_salario_integral_diario()
        salario_diario_normal = self.salario_base_mensual / 30
        alicuota_u = (salario_diario_normal * self.dias_utilidades) / self.dias_base_anual
        alicuota_b = (salario_diario_normal * self.dias_bono_vacacional) / self.dias_base_anual
        garantia = self.calcular_garantia_trimestral()
        advertencias = []
        if self.dias_utilidades < LOTTT_MIN_DIAS_UTILIDADES:
            advertencias.append(
                {
                    "codigo": "utilidades_bajo_minimo",
                    "mensaje": f"Utilidades ({self.dias_utilidades}) bajo mínimo legal 30.",
                }
            )
        if self.dias_bono_vacacional < LOTTT_MIN_DIAS_BONO:
            advertencias.append(
                {
                    "codigo": "bono_bajo_minimo",
                    "mensaje": f"Bono ({self.dias_bono_vacacional}) bajo mínimo legal 15.",
                }
            )

        auditoria = [
            {
                "paso": 1,
                "titulo": "Salario diario normal",
                "formula": "salario_mensual ÷ 30",
                "valor": round(salario_diario_normal, 2),
            },
            {
                "paso": 2,
                "titulo": "Alícuota utilidades",
                "formula": "(diario × días_utilidades) ÷ 360",
                "valor": round(alicuota_u, 2),
            },
            {
                "paso": 3,
                "titulo": "Alícuota bono vacacional",
                "formula": "(diario × días_bono) ÷ 360",
                "valor": round(alicuota_b, 2),
            },
            {
                "paso": 4,
                "titulo": "Salario integral diario",
                "formula": "diario + utilidades + bono",
                "valor": round(sid, 2),
            },
            {
                "paso": 5,
                "titulo": "Garantía trimestral (lit. a)",
                "formula": "integral × 15",
                "valor": round(garantia, 2),
            },
        ]

        out: Dict[str, Any] = {
            "salario_mensual": round(self.salario_base_mensual, 2),
            "salario_diario_base": round(salario_diario_normal, 2),
            "alicuota_utilidades": round(alicuota_u, 2),
            "alicuota_bono_vacacional": round(alicuota_b, 2),
            "salario_integral_diario": round(sid, 2),
            "dias_utilidades": self.dias_utilidades,
            "dias_bono_vacacional": self.dias_bono_vacacional,
            "dias_base_anual": self.dias_base_anual,
            "referencia": "Art. 142 LOTTT",
            "garantia_trimestral": round(garantia, 2),
            "dias_garantia": self.dias_garantia_trimestral,
            "estimacion_anual_garantias": round(garantia * 4, 2),
            "retroactivo": None,
            "metodo": "deterministico_lott_142",
            "version_formula": VERSION_FORMULA,
            "advertencias": advertencias,
            "auditoria": auditoria,
        }

        if bool(fecha_inicio) != bool(fecha_fin):
            raise ValueError("Indique ambas fechas (inicio y fin) o ninguna.")

        if fecha_inicio and fecha_fin:
            inicio = _parse_date(fecha_inicio)
            fin = _parse_date(fecha_fin)
            diff = relativedelta(fin, inicio)
            anios_servicio, fraccion = anios_servicio_computables(diff)
            retro = self.calcular_retroactivo(inicio, fin)
            out["retroactivo"] = {
                "fecha_inicio": inicio.isoformat(),
                "fecha_fin": fin.isoformat(),
                "anios_completos": diff.years,
                "meses_fraccion": diff.months,
                "dias_fraccion": diff.days,
                "fraccion_superior_seis_meses": fraccion,
                "anios_servicio": anios_servicio,
                "dias_retroactivo_por_anio": self.dias_retroactivo_por_anio,
                "retroactivo": round(retro, 2),
                "referencia_retroactivo": "Art. 142 literal f) LOTTT",
            }
            auditoria.append(
                {
                    "paso": 6,
                    "titulo": "Antigüedad computable (lit. f)",
                    "formula": "años + (1 si fracción > 6 meses)",
                    "valor": anios_servicio,
                    "detalle": f"{diff.years}a {diff.months}m {diff.days}d → fraccion>{6}: {fraccion}",
                }
            )
            auditoria.append(
                {
                    "paso": 7,
                    "titulo": "Retroactivo acumulado (lit. f)",
                    "formula": "integral × 60 × años",
                    "valor": round(retro, 2),
                }
            )
            retro_r = round(retro, 2)
        else:
            advertencias.append(
                {
                    "codigo": "sin_retroactivo",
                    "mensaje": "Sin fechas: solo garantía trimestral.",
                }
            )
            retro_r = 0.0

        garantia_r = round(garantia, 2)
        monto = round(max(garantia_r, retro_r), 2)
        if fecha_inicio and fecha_fin:
            if garantia_r == retro_r:
                criterio = "empatados"
            elif retro_r > garantia_r:
                criterio = "retroactivo"
            else:
                criterio = "garantia_trimestral"
        else:
            criterio = "garantia_trimestral"

        auditoria.append(
            {
                "paso": len(auditoria) + 1,
                "titulo": "Monto a provisionar (mayor)",
                "formula": "max(garantía, retroactivo)",
                "valor": monto,
                "detalle": f"max({garantia_r}, {retro_r}) → {criterio}",
            }
        )
        out["monto_a_provisionar"] = monto
        out["criterio_provision"] = criterio
        out["auditoria"] = auditoria
        out["advertencias"] = advertencias
        return out


def main() -> int:
    ap = argparse.ArgumentParser(description="LaborCalculator Art. 142 LOTTT")
    ap.add_argument("--salario", type=float, required=True, help="Salario base mensual")
    ap.add_argument("--utilidades", type=int, default=30)
    ap.add_argument("--bono", type=int, default=15)
    ap.add_argument("--inicio", default=None, help="YYYY-MM-DD (retroactivo lit. f)")
    ap.add_argument("--fin", default=None, help="YYYY-MM-DD (retroactivo lit. f)")
    args = ap.parse_args()

    calc = LaborCalculator(
        args.salario,
        dias_utilidades=args.utilidades,
        dias_bono_vacacional=args.bono,
    )
    print(json.dumps(calc.to_dict(args.inicio, args.fin), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
