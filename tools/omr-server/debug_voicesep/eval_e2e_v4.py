"""End-to-end eval: process_single_staff on real crops with real homr."""
import json
import os
import sys
import tempfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["PATH"] = os.path.join(os.path.dirname(__file__), "..", "venv", "bin") + ":" + os.environ["PATH"]

import cv2
import logging
logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")

from pipeline.staff_processor import process_single_staff

STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

def stats(measures):
    pitched, midis = 0, []
    for m in measures:
        for n in m.findall("note"):
            p = n.find("pitch")
            if p is not None:
                pitched += 1
                octave = int(p.findtext("octave", "4"))
                alter = int(float(p.findtext("alter", "0")))
                midis.append((octave + 1) * 12 + STEP.get(p.findtext("step", "C"), 0) + alter)
    mean = round(sum(midis) / len(midis), 1) if midis else 0
    return {"measures": len(measures), "pitched": pitched, "mean_midi": mean,
            "pitch_seq": midis[:12]}

CASES = [
    ("spike_p1_Co-SA_0.png", "Co.SA"),
    ("spike_p8_Co-SA_0.png", "Co.SA"),
    ("spike_p8_Co-TB_0.png", "Co.TB"),
    ("spike_p13_Co-SA_0.png", "Co.SA"),
]
out = {}
for crop, char in CASES:
    img = cv2.imread(os.path.join(os.path.dirname(__file__), crop))
    with tempfile.TemporaryDirectory() as td:
        result = process_single_staff(char, img, 0, td)
    out[crop] = {name: stats(meas) for name, meas in result.items()}
    print(f"\n=== {crop} ({char}) ===")
    for name, s in out[crop].items():
        print(f"  {name}: {s}")

with open(os.path.join(os.path.dirname(__file__), "eval_e2e_v4_results.json"), "w") as f:
    json.dump(out, f, indent=1)
print("\nDONE")
