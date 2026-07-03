"""Evaluate integrated voice separation on real crops (round 3/3).

For each crop in the reference set:
1. Load with cv2, call separate_voices_image
2. If separated: save up/down images, run homr on each, postprocess, parse stats
3. Check criteria: separated AND up_pitched>=3 AND down_pitched>=1 AND
   mean_midi_up > mean_midi_down AND |up_measures - down_measures| <= 1
PASS = >= 3 of 4 crops meet all criteria.
If failing, diagnose with evidence: check images, XML output, and root cause.
"""

import logging
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np

# Add parent dir to path
sys_path = str(Path(__file__).parent.parent)
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

from core.voice_separator import separate_voices_image
from pipeline.postprocessor import postprocess as postprocess_musicxml


def run_homr_patched(image_path: str, work_dir: str):
    """Wrapper for run_homr that uses full path to homr binary."""
    import subprocess
    import glob
    import os

    for old in glob.glob(os.path.join(work_dir, "*.musicxml")) + glob.glob(
        os.path.join(work_dir, "*.xml")
    ):
        os.remove(old)

    homr_path = str(Path(__file__).parent.parent / "venv" / "bin" / "homr")
    result = subprocess.run(
        [homr_path, image_path],
        capture_output=True,
        text=True,
        timeout=300,
        cwd=work_dir,
    )
    if result.returncode != 0:
        log.error(f"homr failed: {result.stderr[:200]}")
        return None

    xml_files = glob.glob(os.path.join(work_dir, "*.musicxml"))
    if not xml_files:
        xml_files = glob.glob(os.path.join(work_dir, "*.xml"))
    if not xml_files:
        return None

    with open(xml_files[0], "r", encoding="utf-8") as f:
        return f.read()


run_homr = run_homr_patched

logging.basicConfig(
    level=logging.INFO,
    format="%(name)s - %(levelname)s - %(message)s"
)
log = logging.getLogger("eval_voicesep")

CROPS = [
    "spike_p1_Co-SA_0.png",
    "spike_p8_Co-SA_0.png",
    "spike_p8_Co-TB_0.png",
    "spike_p13_Co-SA_0.png",
]
CROP_DIR = Path(__file__).parent
OUT_DIR = Path(__file__).parent


def parse_musicxml(xml_str: str) -> dict:
    """Parse MusicXML string, return note/measure stats."""
    try:
        root = ET.fromstring(xml_str)
    except Exception as e:
        log.error(f"Failed to parse XML: {e}")
        return {
            "pitched_count": 0,
            "mean_midi": 0,
            "measure_count": 0,
        }

    # Find all measures
    measures = root.findall(".//measure")
    measure_count = len(measures)

    # Collect all pitched notes (non-rest, non-chord)
    all_midi = []
    for measure in measures:
        for note in measure.findall("note"):
            if note.find("rest") is not None:
                continue
            if note.find("chord") is not None:
                continue
            pitch = note.find("pitch")
            if pitch is None:
                continue

            # Extract MIDI
            step = pitch.findtext("step", "C")
            octave = int(pitch.findtext("octave", "4"))
            alter_str = pitch.findtext("alter", "0")
            alter = int(alter_str) if alter_str else 0

            # MIDI = (octave+1)*12 + step_offset + alter
            step_to_midi = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
            midi = (octave + 1) * 12 + step_to_midi.get(step, 0) + alter
            all_midi.append(midi)

    mean_midi = float(np.mean(all_midi)) if all_midi else 0.0

    return {
        "pitched_count": len(all_midi),
        "mean_midi": mean_midi,
        "measure_count": measure_count,
    }


def eval_crop(crop_name: str) -> dict:
    """Evaluate one crop.

    Returns dict with keys:
    - crop: str
    - separated: bool
    - up_pitched: int
    - down_pitched: int
    - up_measures: int
    - down_measures: int
    - mean_midi_up: float
    - mean_midi_down: float
    - criteria_met: bool
    - failure_detail: str (if criteria not met)
    """
    crop_path = CROP_DIR / crop_name
    if not crop_path.exists():
        log.error(f"Crop not found: {crop_path}")
        return {
            "crop": crop_name,
            "separated": False,
            "up_pitched": 0,
            "down_pitched": 0,
            "up_measures": 0,
            "down_measures": 0,
            "mean_midi_up": 0.0,
            "mean_midi_down": 0.0,
            "criteria_met": False,
            "failure_detail": "Crop file not found",
        }

    log.info(f"Loading {crop_name}...")
    img = cv2.imread(str(crop_path))
    if img is None:
        log.error(f"Failed to load image: {crop_path}")
        return {
            "crop": crop_name,
            "separated": False,
            "up_pitched": 0,
            "down_pitched": 0,
            "up_measures": 0,
            "down_measures": 0,
            "mean_midi_up": 0.0,
            "mean_midi_down": 0.0,
            "criteria_met": False,
            "failure_detail": "Failed to load image",
        }

    # Try separation
    log.info(f"Calling separate_voices_image on {crop_name}...")
    result = separate_voices_image(img)

    if result is None:
        log.warning(f"Separation returned None for {crop_name}")
        return {
            "crop": crop_name,
            "separated": False,
            "up_pitched": 0,
            "down_pitched": 0,
            "up_measures": 0,
            "down_measures": 0,
            "mean_midi_up": 0.0,
            "mean_midi_down": 0.0,
            "criteria_met": False,
            "failure_detail": "Separation returned None",
        }

    # Save separated images
    stem = crop_name.replace(".png", "")
    up_path = OUT_DIR / f"eval_r3_{stem}_up.png"
    down_path = OUT_DIR / f"eval_r3_{stem}_down.png"

    cv2.imwrite(str(up_path), result.up_img)
    cv2.imwrite(str(down_path), result.down_img)
    log.info(f"Saved separated images: {up_path}, {down_path}")

    # Run homr on each
    with tempfile.TemporaryDirectory() as tmpdir:
        up_img_path = str(Path(tmpdir) / "up.png")
        down_img_path = str(Path(tmpdir) / "down.png")
        cv2.imwrite(up_img_path, result.up_img)
        cv2.imwrite(down_img_path, result.down_img)

        log.info(f"Running homr on up voice for {crop_name}...")
        try:
            up_xml = run_homr(up_img_path, tmpdir)
        except Exception as e:
            log.error(f"homr failed on up voice: {e}")
            up_xml = None

        log.info(f"Running homr on down voice for {crop_name}...")
        try:
            down_xml = run_homr(down_img_path, tmpdir)
        except Exception as e:
            log.error(f"homr failed on down voice: {e}")
            down_xml = None

    # Postprocess
    if up_xml:
        try:
            up_xml = postprocess_musicxml(up_xml)
        except Exception as e:
            log.warning(f"Postprocessing failed for up voice: {e}")

    if down_xml:
        try:
            down_xml = postprocess_musicxml(down_xml)
        except Exception as e:
            log.warning(f"Postprocessing failed for down voice: {e}")

    # Parse stats
    up_stats = parse_musicxml(up_xml) if up_xml else {
        "pitched_count": 0,
        "mean_midi": 0.0,
        "measure_count": 0,
    }
    down_stats = parse_musicxml(down_xml) if down_xml else {
        "pitched_count": 0,
        "mean_midi": 0.0,
        "measure_count": 0,
    }

    up_pitched = up_stats["pitched_count"]
    down_pitched = down_stats["pitched_count"]
    up_measures = up_stats["measure_count"]
    down_measures = down_stats["measure_count"]
    mean_midi_up = up_stats["mean_midi"]
    mean_midi_down = down_stats["mean_midi"]

    # Check criteria
    criteria_met = (
        up_pitched >= 3
        and down_pitched >= 1
        and mean_midi_up > mean_midi_down
        and abs(up_measures - down_measures) <= 1
    )

    failure_detail = ""
    if not criteria_met:
        failures = []
        if up_pitched < 3:
            failures.append(f"up_pitched={up_pitched} < 3")
        if down_pitched < 1:
            failures.append(f"down_pitched={down_pitched} < 1")
        if mean_midi_up <= mean_midi_down:
            failures.append(
                f"mean_midi_up={mean_midi_up:.1f} <= mean_midi_down={mean_midi_down:.1f}"
            )
        if abs(up_measures - down_measures) > 1:
            failures.append(
                f"|up_measures - down_measures| = {abs(up_measures - down_measures)} > 1"
            )
        failure_detail = "; ".join(failures)

    return {
        "crop": crop_name,
        "separated": True,
        "up_pitched": up_pitched,
        "down_pitched": down_pitched,
        "up_measures": up_measures,
        "down_measures": down_measures,
        "mean_midi_up": mean_midi_up,
        "mean_midi_down": mean_midi_down,
        "criteria_met": criteria_met,
        "failure_detail": failure_detail,
    }


def main():
    """Run evaluation on all crops."""
    log.info("Starting voice separation evaluation (round 3/3)...")
    log.info(f"Crops to evaluate: {CROPS}")

    results = []
    for crop in CROPS:
        result = eval_crop(crop)
        results.append(result)
        log.info(f"  {crop}: {result}")

    # Summarize
    passing = sum(1 for r in results if r["criteria_met"])
    log.info("\n=== SUMMARY ===")
    log.info(f"Passing crops: {passing}/{len(results)}")
    log.info(f"OVERALL PASS: {passing >= 3}")

    for result in results:
        status = "PASS" if result["criteria_met"] else "FAIL"
        log.info(
            f"{status}: {result['crop']} | "
            f"separated={result['separated']} | "
            f"up={result['up_pitched']}/{result['up_measures']} "
            f"mean_midi={result['mean_midi_up']:.1f} | "
            f"down={result['down_pitched']}/{result['down_measures']} "
            f"mean_midi={result['mean_midi_down']:.1f}"
        )
        if result["failure_detail"]:
            log.info(f"  Failures: {result['failure_detail']}")

    return results, passing >= 3


if __name__ == "__main__":
    results, overall_pass = main()
    sys.exit(0 if overall_pass else 1)
