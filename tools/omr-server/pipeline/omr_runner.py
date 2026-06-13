"""OMR pipeline: homr subprocess invocation, quality scoring."""

import glob
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from pipeline.postprocessor import postprocess as postprocess_musicxml
from pipeline.strategies import STRATEGIES

log = logging.getLogger("omr.runner")

MIN_ACCEPTABLE_SCORE = 40.0


# ── Quality scoring ─────────────────────────────────────────────────────────

def score_musicxml(xml_string: str) -> tuple[float, dict]:
    """Score a MusicXML result for quality. Returns (score_0_100, details_dict)."""
    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError:
        return 0.0, {"error": "invalid XML"}

    all_notes = root.findall(".//note")
    pitched = [n for n in all_notes if n.find("pitch") is not None]
    rests = [n for n in all_notes if n.find("rest") is not None]
    measures = root.findall(".//measure")

    note_count = len(pitched)
    if note_count == 0:
        return 0.0, {"error": "no pitched notes"}

    score = min(note_count / 50, 1.0) * 40
    total = note_count + len(rests)
    note_ratio = note_count / total if total > 0 else 0
    score += note_ratio * 20

    pitches = {
        f"{n.find('pitch').findtext('step', '')}{n.find('pitch').findtext('octave', '')}"
        for n in pitched
    }
    score += min(len(pitches) / 12, 1.0) * 15

    durations = {n.findtext("duration", "0") for n in pitched}
    score += min(len(durations) / 4, 1.0) * 10

    measure_count = len(measures)
    if measure_count > 0:
        npm = note_count / measure_count
        density_score = 15 if 2 <= npm <= 8 else (10 if 1 <= npm <= 16 else 5)
    else:
        density_score = 0
    score += density_score

    chord_notes = [n for n in all_notes if n.find("chord") is not None]

    return round(score, 1), {
        "notes": note_count,
        "rests": len(rests),
        "measures": measure_count,
        "pitches": len(pitches),
        "durations": len(durations),
        "chord_notes": len(chord_notes),
        "note_ratio": round(note_ratio, 2),
        "notes_per_measure": round(note_count / max(measure_count, 1), 1),
    }


# ── homr invocation ─────────────────────────────────────────────────────────

def _homr_executable() -> str:
    """Resolve the homr CLI: PATH first, then next to the interpreter.

    Servers started as ./venv/bin/python main.py lack venv/bin on PATH —
    bare "homr" then fails and every staff silently yields nothing.
    """
    found = shutil.which("homr")
    if found:
        return found
    return str(Path(sys.executable).parent / "homr")


def run_homr(image_path: str, work_dir: str) -> Optional[str]:
    """Run homr on an image file. Returns MusicXML string or None on failure.

    Routes through the persistent worker pool when it is running (models stay
    warm); otherwise falls back to the homr CLI subprocess.
    """
    from pipeline import homr_pool

    if homr_pool.pool_running():
        return homr_pool.run_homr_pooled(image_path)

    for old in glob.glob(os.path.join(work_dir, "*.musicxml")) + glob.glob(os.path.join(work_dir, "*.xml")):
        os.remove(old)

    try:
        result = subprocess.run(
            [_homr_executable(), image_path],
            capture_output=True, text=True, timeout=300, cwd=work_dir,
        )
    except FileNotFoundError:
        log.error("homr binary not found on PATH")
        return None
    except (subprocess.TimeoutExpired, OSError) as exc:
        log.error(f"homr invocation failed: {exc}")
        return None
    if result.returncode != 0:
        log.error(f"homr failed: {result.stderr[:200]}")
        return None

    xml_files = glob.glob(os.path.join(work_dir, "*.musicxml"))
    if not xml_files:
        xml_files = glob.glob(os.path.join(work_dir, "*.xml"))
    if not xml_files:
        base = os.path.splitext(image_path)[0]
        for ext in (".musicxml", ".xml"):
            if os.path.exists(base + ext):
                xml_files = [base + ext]
                break
    if not xml_files:
        return None

    with open(xml_files[0], "r", encoding="utf-8") as f:
        return f.read()


def _try_strategy(
    name: str,
    preprocessor,
    raw_image: np.ndarray,
    base_dir: str,
) -> tuple[str, Optional[str], float, dict]:
    """Apply one preprocessing strategy and run homr. Returns (name, xml, score, details)."""
    strategy_dir = os.path.join(base_dir, name)
    os.makedirs(strategy_dir, exist_ok=True)
    img_path = os.path.join(strategy_dir, "input.png")

    try:
        processed = preprocessor(raw_image)
        cv2.imwrite(img_path, processed)
    except Exception as e:
        log.warning(f"  [{name}] preprocessing failed: {e}")
        return name, None, 0.0, {"error": str(e)}

    xml = run_homr(img_path, strategy_dir)
    if xml is None:
        return name, None, 0.0, {"error": "homr failed"}

    score, details = score_musicxml(xml)
    log.info(f"  [{name}] score={score:.1f} | {details}")
    return name, xml, score, details


def run_best_strategy(image: np.ndarray) -> tuple[str, float, str]:
    """Try all preprocessing strategies and return the best MusicXML result.

    Returns (musicxml_string, quality_score, strategy_name).
    Raises RuntimeError if all strategies fail.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        best_xml: Optional[str] = None
        best_score = 0.0
        best_strategy = ""

        # Phase 1: fast strategies (original, otsu, adaptive)
        for name, preprocessor in STRATEGIES[:3]:
            _, xml, score, _ = _try_strategy(name, preprocessor, image, tmpdir)
            if xml and score > best_score:
                best_xml, best_score, best_strategy = xml, score, name
            if best_score >= MIN_ACCEPTABLE_SCORE:
                break

        # Phase 2: remaining strategies in parallel if Phase 1 insufficient
        if best_score < MIN_ACCEPTABLE_SCORE:
            max_w = max(1, min(len(STRATEGIES[3:]), (os.cpu_count() or 4) // 2))
            with ThreadPoolExecutor(max_workers=max_w) as executor:
                futures = {
                    executor.submit(_try_strategy, name, prep, image, tmpdir): name
                    for name, prep in STRATEGIES[3:]
                }
                for future in as_completed(futures):
                    try:
                        _, xml, score, _ = future.result()
                        if xml and score > best_score:
                            best_xml, best_score, best_strategy = xml, score, futures[future]
                    except Exception as e:
                        log.warning(f"Strategy failed: {e}")

        if best_xml is None:
            raise RuntimeError("All OMR strategies failed")

        try:
            best_xml = postprocess_musicxml(best_xml)
        except Exception as e:
            log.warning(f"Post-processing failed: {e}")

        return best_xml, best_score, best_strategy


# Proven chord-recall set (2026-06-11 sweeps). scale2 forbidden: homr collapses.
CHORD_STRATEGY_NAMES = ("original", "adaptive", "sharpen", "scale1.5")


def run_chord_strategy(image: np.ndarray) -> tuple[str, float, str]:
    """Multi-strategy OMR optimised for CHORD recall (compound SATB staves).

    run_best_strategy's generic score can prefer chord-poorer results and its
    early-exit skips exploration; here all CHORD_STRATEGY_NAMES run and the
    pick maximises (chord_notes, pitched, score) — chords carry voice 2.
    Returns (postprocessed_musicxml, score, strategy). Raises RuntimeError
    when every strategy fails.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        candidates = []
        for name, prep in [(n, p) for n, p in STRATEGIES if n in CHORD_STRATEGY_NAMES]:
            _, xml, score, details = _try_strategy(name, prep, image, tmpdir)
            if xml:
                key = (details.get("chord_notes", 0), details.get("notes", 0), score)
                candidates.append((key, xml, score, name))

        if not candidates:
            raise RuntimeError("All OMR strategies failed")

        candidates.sort(key=lambda c: c[0], reverse=True)
        _, best_xml, best_score, best_name = candidates[0]
        log.info(
            f"chord strategy: picked {best_name} "
            f"(chords={candidates[0][0][0]}, notes={candidates[0][0][1]})"
        )

        try:
            best_xml = postprocess_musicxml(best_xml)
        except Exception as e:
            log.warning(f"Post-processing failed: {e}")

        return best_xml, best_score, best_name


