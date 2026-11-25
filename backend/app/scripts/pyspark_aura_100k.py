"""Script ejecutable de Apache Spark (PySpark) para generar, validar, transformar
y exportar los 100,000 registros de evaluacion de competencias de AURA Talent AI
(20,000 candidatos x 5 competencias laborales en 8 particiones).

Si PySpark esta instalado en el entorno, levanta `SparkSession.builder.master("local[*]")`
con esquema explicito `StructType`, valida integridad, calcula transformaciones
distribuidas y escribe Parquet particionado por `competencia`. Si no hay JVM
local, utiliza el motor columnar particionado de `ml_talent_bigdata.py`.

Uso:
    .venv\\Scripts\\python -m app.scripts.pyspark_aura_100k
"""

from __future__ import annotations

import json
from pathlib import Path

from app.analytics.ml_talent_bigdata import (
    COMPETENCIAS_AURA,
    LOTE_SPARK_ID,
    NUM_PARTICIONES_SPARK,
    TOTAL_CANDIDATOS_MASIVO,
    TOTAL_REGISTROS_SPARK,
    get_spark_100k_analytics,
)

OUT_DIR = Path(__file__).resolve().parents[2] / "storage" / "spark_100k"


def main() -> None:
    print("=" * 68)
    print("AURA TALENT AI - PROCESAMIENTO MASIVO PYSPARK (100,000 REGISTROS)")
    print("=" * 68)
    print(f"Lote ID:                {LOTE_SPARK_ID}")
    print(f"Candidatos simulados:   {TOTAL_CANDIDATOS_MASIVO:,}")
    print(f"Competencias por perfil:{len(COMPETENCIAS_AURA)}")
    print(f"Registros totales:      {TOTAL_REGISTROS_SPARK:,}")
    print(f"Particiones Spark:      {NUM_PARTICIONES_SPARK}")

    res = get_spark_100k_analytics(force_rebuild=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    (OUT_DIR / "resumen_competencias_100k.csv").write_text(
        res["resumen_csv"], encoding="utf-8"
    )
    (OUT_DIR / "muestra_registros_100k.csv").write_text(
        res["muestra_csv"], encoding="utf-8"
    )
    (OUT_DIR / "reporte_spark_100k.json").write_text(
        json.dumps(
            {
                "lote_id": res["lote_id"],
                "tiempo_procesamiento_ms": res["tiempo_procesamiento_ms"],
                "configuracion": res["configuracion"],
                "validaciones_integridad": res["validaciones_integridad"],
                "kpis_globales": res["kpis_globales"],
                "resumen_competencias": res["resumen_competencias"],
                "resumen_particiones": res["resumen_particiones"],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Tiempo de procesamiento: {res['tiempo_procesamiento_ms']} ms")
    print("Validacion:", res["validaciones_integridad"]["estado"])
    print("Archivos generados en:", OUT_DIR)


if __name__ == "__main__":
    main()
