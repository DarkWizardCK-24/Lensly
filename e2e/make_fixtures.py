"""Generate real statement files for the Phase 5 end-to-end test, using the backend's test builders.
Run from the repo root with the backend venv:  backend/.venv/Scripts/python apps/statement_analyzer_web/e2e/make_fixtures.py"""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
backend = os.path.abspath(os.path.join(here, "..", "..", "..", "backend"))
sys.path.insert(0, backend)
from tests.dp_fixtures import csv_bytes, pdf_bytes, scanned_pdf_bytes, xlsx_bytes  # noqa: E402

out = os.path.join(here, "fixtures")
os.makedirs(out, exist_ok=True)
files = {
    "statement.csv": csv_bytes(),
    "locked.pdf": pdf_bytes(encrypt="Unlock#2026"),
    "scanned.pdf": scanned_pdf_bytes(),
    "statement.xlsx": xlsx_bytes(),
    "fake.pdf": b"this is not really a pdf",
}
for n, b in files.items():
    open(os.path.join(out, n), "wb").write(b)
print("fixtures:", ", ".join(files))
