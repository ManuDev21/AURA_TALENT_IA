"""Almacenamiento local de archivos (desarrollo). Interfaz lista para cambiar a S3-compatible."""

import hashlib
import io
import uuid
import zipfile
from pathlib import Path

from app.core.errors import ValidationFailedError

STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_DOCX_XML_BYTES = 20 * 1024 * 1024

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def detect_document_type(data: bytes) -> str:
    """Valida el tipo real por su contenido (no por la extension ni el Content-Type)."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValidationFailedError("El archivo supera el limite de 5 MB.", code="file_too_large")
    if data.startswith(b"%PDF-"):
        return PDF_MIME
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                info = archive.getinfo("word/document.xml")
                if info.file_size > MAX_DOCX_XML_BYTES:
                    raise ValidationFailedError("El documento es demasiado grande para analizarse.")
                return DOCX_MIME
        except (KeyError, zipfile.BadZipFile):
            pass
    raise ValidationFailedError(
        "Formato no soportado. Sube un archivo PDF o DOCX.", code="unsupported_format"
    )


class LocalStorage:
    def __init__(self, root: Path = STORAGE_ROOT) -> None:
        self.root = root

    def save(self, namespace: str, data: bytes, extension: str) -> str:
        key = f"{namespace}/{uuid.uuid4().hex}.{extension}"
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError("Ruta de almacenamiento invalida")
        return path


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
