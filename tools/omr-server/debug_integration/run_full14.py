"""Full 14-page integration run: Road To Hell I through the complete vocal pipeline."""
import json
import logging
import os
import sys
import time
import tempfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["PATH"] = os.path.join(os.path.dirname(__file__), "..", "venv", "bin") + ":" + os.environ["PATH"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s: %(message)s")

from omr_queue.vocal_pipeline import run_vocal_score_pipeline

BASE = os.path.join(os.path.dirname(__file__), "..", "reference")
PAGES = [os.path.join(BASE, f"하데스타운 악보 통합본-{i:03d}.png") for i in range(1, 15)]
assert all(os.path.exists(p) for p in PAGES), "missing reference pages"

def progress(pct):
    print(f"### PROGRESS {pct}%", flush=True)

t0 = time.time()
xml = run_vocal_score_pipeline([PAGES], tempfile.mkdtemp(), "Road To Hell I", progress)
elapsed = time.time() - t0

out_path = os.path.join(os.path.dirname(__file__), "road_to_hell_full14.musicxml")
open(out_path, "w").write(xml)

# Validation summary
STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
root = ET.fromstring(xml)
summary = {"elapsed_min": round(elapsed / 60, 1), "parts": {}}
id_to_name = {
    sp.get("id"): (sp.findtext("part-name") or sp.get("id"))
    for sp in root.findall(".//score-part")
}
for part in root.findall(".//part"):
    name = id_to_name.get(part.get("id"), part.get("id"))
    measures = part.findall("measure")
    pitched, midis = 0, []
    for m in measures:
        for n in m.findall("note"):
            p = n.find("pitch")
            if p is not None:
                pitched += 1
                octv = int(p.findtext("octave", "4"))
                alt = int(float(p.findtext("alter", "0")))
                midis.append((octv + 1) * 12 + STEP.get(p.findtext("step", "C"), 0) + alt)
    summary["parts"][name] = {
        "measures": len(measures),
        "pitched": pitched,
        "mean_midi": round(sum(midis) / len(midis), 1) if midis else 0,
    }
json.dump(summary, open(os.path.join(os.path.dirname(__file__), "full14_summary.json"), "w"), indent=1, ensure_ascii=False)
print("### SUMMARY", json.dumps(summary, ensure_ascii=False))
print("### DONE", out_path)
