#!/usr/bin/env python3
"""Run homr on selected Co.SA and Co.TB crops and analyze results."""

import os
import sys
import logging
import tempfile
import xml.etree.ElementTree as ET


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline.omr_runner import run_homr
from pipeline.postprocessor import postprocess as postprocess_musicxml

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

DEBUG_DIR = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_voicesep"
HOMR_BIN = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/venv/bin/homr"

# Patch subprocess call to use full path
import subprocess as _subprocess_orig
_orig_run = _subprocess_orig.run

def _patched_run(cmd, **kwargs):
    if cmd and cmd[0] == "homr":
        cmd = [HOMR_BIN] + cmd[1:]
    return _orig_run(cmd, **kwargs)

_subprocess_orig.run = _patched_run

# Select 6 crops: prefer page 008 and 013
CROPS_TO_TEST = [
    "page_008_Co.SA_sys1.png",
    "page_008_Co.TB_sys2.png",
    "page_013_Co.SA_sys0.png",
    "page_013_Co.TB_sys1.png",
    "page_001_Co.SA_sys1.png",
    "page_001_Co.TB_sys0.png",
]

def analyze_musicxml(xml_string):
    """Parse XML and extract statistics."""
    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError as e:
        return {"error": str(e)}

    measures = root.findall(".//measure")
    pitched_notes = root.findall(".//note[pitch]")
    chords = root.findall(".//note[chord]")
    voices = set()
    for note in root.findall(".//note"):
        v = note.find("voice")
        if v is not None and v.text:
            voices.add(v.text)

    # Extract first few pitches for pitch summary
    pitch_summary = []
    for note in pitched_notes[:10]:
        pitch_elem = note.find("pitch")
        if pitch_elem is not None:
            step = pitch_elem.findtext("step", "?")
            octave = pitch_elem.findtext("octave", "?")
            pitch_summary.append(f"{step}{octave}")

    return {
        "n_measures": len(measures),
        "n_pitched_notes": len(pitched_notes),
        "n_chord_notes": len(chords),
        "n_voices": len(voices),
        "voice_ids": sorted(list(voices)),
        "pitch_summary": " ".join(pitch_summary[:5]),
    }

def main():
    """Run homr on each crop."""
    os.makedirs(DEBUG_DIR, exist_ok=True)

    results = []

    for crop_name in CROPS_TO_TEST:
        crop_path = os.path.join(DEBUG_DIR, crop_name)
        if not os.path.exists(crop_path):
            log.warning(f"Crop not found: {crop_path}")
            continue

        log.info(f"\nProcessing: {crop_name}")

        # Run homr
        with tempfile.TemporaryDirectory() as tmpdir:
            xml = run_homr(crop_path, tmpdir)

        if xml is None:
            log.error(f"  homr failed for {crop_name}")
            results.append({
                "crop": crop_name,
                "succeeded": False,
                "analysis": {"error": "homr failed"}
            })
            continue

        # Post-process XML
        try:
            xml = postprocess_musicxml(xml)
        except Exception as e:
            log.warning(f"  Post-processing failed: {e}")

        # Save raw XML output
        xml_output_path = os.path.join(DEBUG_DIR, crop_name.replace(".png", ".xml"))
        with open(xml_output_path, "w", encoding="utf-8") as f:
            f.write(xml)
        log.info(f"  Saved XML: {xml_output_path}")

        # Analyze
        analysis = analyze_musicxml(xml)
        log.info(f"  Analysis: {analysis}")

        results.append({
            "crop": crop_name,
            "succeeded": True,
            "analysis": analysis,
            "xml_path": xml_output_path,
        })

    # Print summary
    log.info("\n" + "="*80)
    log.info("SUMMARY")
    log.info("="*80)
    for result in results:
        crop = result["crop"]
        if result["succeeded"]:
            a = result["analysis"]
            log.info(f"{crop:40s} | measures={a.get('n_measures', '?'):2d} notes={a.get('n_pitched_notes', '?'):2d} voices={a.get('n_voices', '?')} chords={a.get('n_chord_notes', '?')} | {a.get('pitch_summary', '')}")
        else:
            log.info(f"{crop:40s} | FAILED")

if __name__ == "__main__":
    main()
