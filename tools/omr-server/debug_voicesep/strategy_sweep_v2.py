"""Sweep v2: upscaling + dilation candidates for chord recall."""
import json, os, sys, tempfile
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["PATH"] = os.path.join(os.path.dirname(__file__), "..", "venv", "bin") + ":" + os.environ["PATH"]
import cv2
import numpy as np
from pipeline.strategies import STRATEGIES
from pipeline.omr_runner import run_homr, score_musicxml
from core.staff_cropper import replace_x_noteheads

S = dict(STRATEGIES)

def gray(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

def scale(f, interp=cv2.INTER_CUBIC):
    def fn(img):
        g = gray(img)
        return cv2.resize(g, None, fx=f, fy=f, interpolation=interp)
    return fn

def scale_then(f, name):
    def fn(img):
        return S[name](scale(f)(img))
    return fn

def dilate1(img):
    g = gray(img)
    _, b = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    b = cv2.dilate(b, np.ones((2, 2), np.uint8))
    return 255 - b

CANDIDATES = [
    ("original", S["original"]),
    ("adaptive", S["adaptive"]),
    ("sharpen", S["sharpen"]),
    ("scale1.5", scale(1.5)),
    ("scale2", scale(2.0)),
    ("scale2_adaptive", scale_then(2.0, "adaptive")),
    ("scale2_sharpen", scale_then(2.0, "sharpen")),
    ("dilate1", dilate1),
]

def chord_stats(xml):
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return {"error": "parse"}
    notes = root.findall(".//note")
    pitched = [n for n in notes if n.find("pitch") is not None]
    chords = [n for n in notes if n.find("chord") is not None]
    return {"pitched": len(pitched), "chord_notes": len(chords),
            "measures": len(root.findall(".//measure"))}

out = {}
for crop in ["spike_p13_Co-SA_0.png", "spike_p8_Co-TB_0.png", "spike_p8_Co-SA_0.png"]:
    img = cv2.imread(os.path.join(os.path.dirname(__file__), crop))
    processed, x_positions, staff_width = replace_x_noteheads(img)
    out[crop] = {}
    for name, prep in CANDIDATES:
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "in.png")
            try:
                cv2.imwrite(p, prep(processed))
            except Exception as e:
                out[crop][name] = {"error": str(e)}; continue
            xml = run_homr(p, td)
        if xml is None:
            out[crop][name] = {"error": "homr failed"}
        else:
            s = chord_stats(xml)
            s["score"] = score_musicxml(xml)[0]
            out[crop][name] = s
        print(crop, name, out[crop][name], flush=True)

with open(os.path.join(os.path.dirname(__file__), "strategy_sweep_v2.json"), "w") as f:
    json.dump(out, f, indent=1)
print("DONE")
