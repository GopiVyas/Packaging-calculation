"""Hand-checked tests for the CAD service:  python -m pytest -q   (or: python test_app.py)"""
import math
from pathlib import Path

from fastapi.testclient import TestClient

from app import app

client = TestClient(app)
SAMPLES = Path(__file__).parent / "samples"


def analyze(name):
    with open(SAMPLES / name, "rb") as f:
        r = client.post("/analyze", files={"file": (name, f, "application/step")})
    assert r.status_code == 200, r.text
    return r.json()


def test_clamp_volume_and_box():
    d = analyze("clamp.step")
    # base 50×30×8 + stem 22×20×40 + top 66×38×9 + boss π·7²·8 − hole π·3²·65
    expected = 12000 + 17600 + 22572 + math.pi * 49 * 8 - math.pi * 9 * 65
    assert abs(d["volumeMm3"] - expected) < 1
    assert d["bbox"] == {"l": 66.0, "w": 38.0, "h": 65.0}
    assert d["watertight"] and d["solids"] == 1 and d["glbBase64"]


def test_flange_volume():
    d = analyze("flange.step")
    expected = math.pi * 60**2 * 12 + math.pi * 25**2 * 30 - math.pi * 15**2 * 42 - 4 * math.pi * 5**2 * 12
    assert abs(d["volumeMm3"] - expected) < 1
    assert d["bbox"] == {"l": 120.0, "w": 120.0, "h": 42.0}


def test_rejects_bad_files():
    r = client.post("/analyze", files={"file": ("x.step", b"not a step file", "application/step")})
    assert r.status_code == 400
    r = client.post("/analyze", files={"file": ("x.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 400


if __name__ == "__main__":
    for fn in (test_clamp_volume_and_box, test_flange_volume, test_rejects_bad_files):
        fn()
        print("ok", fn.__name__)
