"""Diagnose: where do scale1.5's 4 chord notes go in split_voices?"""
import os, sys, tempfile
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["PATH"] = os.path.join(os.path.dirname(__file__), "..", "venv", "bin") + ":" + os.environ["PATH"]
import cv2
from pipeline.strategies import preprocess_scale15
from pipeline.omr_runner import run_homr
from pipeline.postprocessor import postprocess
from pipeline.voice_splitter import split_voices
from core.staff_cropper import replace_x_noteheads

img = cv2.imread(os.path.join(os.path.dirname(__file__), "spike_p8_Co-SA_0.png"))
processed = replace_x_noteheads(img)
with tempfile.TemporaryDirectory() as td:
    p = os.path.join(td, "in.png")
    cv2.imwrite(p, preprocess_scale15(processed))
    raw = run_homr(p, td)

open(os.path.join(os.path.dirname(__file__), "diag_p8sa_raw.xml"), "w").write(raw)
post = postprocess(raw)
open(os.path.join(os.path.dirname(__file__), "diag_p8sa_post.xml"), "w").write(post)

def describe(xml, label):
    root = ET.fromstring(xml)
    print(f"--- {label} ---")
    for m in root.findall(".//measure"):
        items = []
        for n in m.findall("note"):
            is_chord = n.find("chord") is not None
            p_el = n.find("pitch")
            if p_el is None:
                items.append("R" + ("c" if is_chord else ""))
            else:
                tag = f"{p_el.findtext('step')}{p_el.findtext('octave')}"
                items.append(("+" if is_chord else "") + tag)
        print(f"  M{m.get('number')}: {' '.join(items)}")

describe(raw, "RAW homr")
describe(post, "POSTPROCESSED")
parts = split_voices(post)
for k, v in parts.items():
    describe(v, f"SPLIT {k}")
