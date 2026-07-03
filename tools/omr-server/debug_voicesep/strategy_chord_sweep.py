"""Measure chord recall per preprocessing strategy on chord-rich crops."""
import json, os, sys, tempfile
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["PATH"] = os.path.join(os.path.dirname(__file__), "..", "venv", "bin") + ":" + os.environ["PATH"]
import cv2
from pipeline.strategies import STRATEGIES
from pipeline.omr_runner import run_homr, score_musicxml
from core.staff_cropper import replace_x_noteheads

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
for crop in ["spike_p13_Co-SA_0.png", "spike_p8_Co-TB_0.png"]:
    img = cv2.imread(os.path.join(os.path.dirname(__file__), crop))
    processed = replace_x_noteheads(img)
    out[crop] = {}
    for name, prep in STRATEGIES:
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

with open(os.path.join(os.path.dirname(__file__), "strategy_chord_sweep.json"), "w") as f:
    json.dump(out, f, indent=1)
print("DONE")
