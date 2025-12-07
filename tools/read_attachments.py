"""
Utilidad para leer archivos locales y entregar su contenido como JSON.
Soporta: PDF, CSV, XLS/XLSX, DOCX y texto plano.

Requerimientos (instala con pip si hace falta):
  pip install pypdf python-docx pandas openpyxl

Uso:
  python tools/read_attachments.py ruta/al/archivo1.pdf ruta/al/archivo2.xlsx ...
"""

import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


def read_pdf(path: Path) -> str:
    from pypdf import PdfReader  # type: ignore

    reader = PdfReader(str(path))
    texts = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(texts).strip()


def read_docx(path: Path) -> str:
    from docx import Document  # type: ignore

    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs).strip()


def read_csv_file(path: Path) -> List[List[str]]:
    rows: List[List[str]] = []
    with path.open("r", encoding="utf-8", errors="ignore") as fh:
        reader = csv.reader(fh)
        for i, row in enumerate(reader):
            rows.append(row)
            if i >= 999:  # limitar filas para no explotar la salida
                break
    return rows


def read_excel(path: Path) -> List[Dict[str, Any]]:
    import pandas as pd  # type: ignore

    df = pd.read_excel(path, sheet_name=0)
    return df.to_dict(orient="records")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def handle_file(path: Path) -> Dict[str, Any]:
    ext = path.suffix.lower()
    result: Dict[str, Any] = {"file": str(path), "type": ext.lstrip(".")}
    try:
        if ext == ".pdf":
            result["content"] = read_pdf(path)
        elif ext in (".docx",):
            result["content"] = read_docx(path)
        elif ext in (".csv",):
            result["rows"] = read_csv_file(path)
        elif ext in (".xls", ".xlsx"):
            result["rows"] = read_excel(path)
        else:
            result["content"] = read_text(path)
        return result
    except Exception as err:  # noqa: BLE001
        result["error"] = str(err)
        return result


def main() -> None:
    if len(sys.argv) < 2:
        print("[]")
        return
    outputs = [handle_file(Path(arg)) for arg in sys.argv[1:]]
    print(json.dumps(outputs, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
