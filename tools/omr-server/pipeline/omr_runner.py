"""OMR pipeline: homr subprocess invocation, preprocessing strategies, quality scoring."""

import glob
import logging
import os
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import cv2
import numpy as np

from pipeline.postprocessor import postprocess as postprocess_musicxml
from pipeline.voice_splitter import split_voices

log = logging.getLogger("omr.runner")

MIN_ACCEPTABLE_SCORE = 40.0


# ── Preprocessing strategies ────────────────────────────────────────────────

def _preprocess_original(img: np.ndarray) -> np.ndarray:
    return img


def _preprocess_otsu(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _preprocess_adaptive(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 10)


def _preprocess_high_contrast(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _preprocess_denoise(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    denoised = cv2.fastNlMeansDenoising(gray, h=12)
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _preprocess_deskew(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)
    if lines is None or len(lines) < 5:
        return img
    angles = [
        np.degrees(np.arctan2(line[0][3] - line[0][1], line[0][2] - line[0][0]))
        for line in lines
        if abs(np.degrees(np.arctan2(line[0][3] - line[0][1], line[0][2] - line[0][0]))) < 10
    ]
    if not angles:
        return img
    median_angle = np.median(angles)
    if abs(median_angle) < 0.3:
        return img
    h, w = gray.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), median_angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def _preprocess_sharpen(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    _, binary = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


STRATEGIES = [
    ("original", _preprocess_original),
    ("otsu", _preprocess_otsu),
    ("adaptive", _preprocess_adaptive),
    ("high_contrast", _preprocess_high_contrast),
    ("denoise", _preprocess_denoise),
    ("deskew", _preprocess_deskew),
    ("sharpen", _preprocess_sharpen),
]


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

    return round(score, 1), {
        "notes": note_count,
        "rests": len(rests),
        "measures": measure_count,
        "pitches": len(pitches),
        "durations": len(durations),
        "note_ratio": round(note_ratio, 2),
        "notes_per_measure": round(note_count / max(measure_count, 1), 1),
    }


# ── homr invocation ─────────────────────────────────────────────────────────

def run_homr(image_path: str, work_dir: str) -> Optional[str]:
    """Run homr on an image file. Returns MusicXML string or None on failure."""
    for old in glob.glob(os.path.join(work_dir, "*.musicxml")) + glob.glob(os.path.join(work_dir, "*.xml")):
        os.remove(old)

    result = subprocess.run(
        ["homr", image_path],
        capture_output=True, text=True, timeout=300, cwd=work_dir,
    )
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


def process_page(
    image_path: str,
    page_num: int,
    tmp_dir: str,
    output_dir: Optional[str] = None,
) -> list[ET.Element]:
    """Process a single page image: crop → homr → postprocess → return measures."""
    from core.staff_cropper import crop_vocal_staff, replace_x_noteheads

    log.info(f"=== Page {page_num}: {os.path.basename(image_path)} ===")
    img = cv2.imread(image_path)
    if img is None:
        log.error(f"Could not read image: {image_path}")
        return []

    cropped = crop_vocal_staff(img)
    if cropped is None:
        log.warning("Staff cropping failed, using raw image")
        cropped = img

    if output_dir:
        cv2.imwrite(os.path.join(output_dir, f"page{page_num}_cropped.png"), cropped)

    processed = replace_x_noteheads(cropped)
    processed_path = os.path.join(tmp_dir, f"page{page_num}_processed.png")
    cv2.imwrite(processed_path, processed)

    raw_xml = run_homr(processed_path, tmp_dir)
    if raw_xml is None:
        return []

    processed_xml = postprocess_musicxml(raw_xml)

    try:
        root = ET.fromstring(processed_xml)
    except ET.ParseError as e:
        log.error(f"Failed to parse XML: {e}")
        return []

    part = root.find(".//part")
    return list(part.findall("measure")) if part is not None else []


def process_single_staff(
    character: str,
    staff_image: np.ndarray,
    system_idx: int,
    tmp_dir: str,
    output_dir: Optional[str] = None,
) -> dict[str, list[ET.Element]]:
    """Process one staff image through OMR pipeline.

    Handles compound SATB staves (Co.SA / Co.TB) by voice-splitting.

    Returns dict mapping character name -> list of measure Elements.
    """
    from core.staff_cropper import replace_x_noteheads

    COMPOUND_VOICES = {"Co.SA": ("Soprano", "Alto"), "Co.TB": ("Tenor", "Bass")}
    safe_name = character.replace(" ", "_").replace(".", "")
    tag = f"{safe_name}_sys{system_idx}"

    if output_dir:
        cv2.imwrite(os.path.join(output_dir, f"{tag}_cropped.png"), staff_image)

    # x-notehead replacement then direct OMR on clean image
    processed = replace_x_noteheads(staff_image)
    with tempfile.TemporaryDirectory() as _omr_dir:
        _img_path = os.path.join(_omr_dir, f"{tag}.png")
        cv2.imwrite(_img_path, processed)
        raw_xml = run_homr(_img_path, _omr_dir)

    if raw_xml is None:
        if character in COMPOUND_VOICES:
            v1, v2 = COMPOUND_VOICES[character]
            return {v1: [], v2: []}
        return {character: []}

    processed_xml = postprocess_musicxml(raw_xml)

    if character in COMPOUND_VOICES:
        v1_name, v2_name = COMPOUND_VOICES[character]
        voice_parts = split_voices(processed_xml)
        result: dict[str, list[ET.Element]] = {}
        for voice_key, voice_name in [("voice1", v1_name), ("voice2", v2_name)]:
            voice_xml = voice_parts.get(voice_key)
            if voice_xml is None:
                result[voice_name] = []
                continue
            try:
                vroot = ET.fromstring(voice_xml)
            except ET.ParseError:
                result[voice_name] = []
                continue
            vpart = vroot.find(".//part")
            result[voice_name] = list(vpart.findall("measure")) if vpart is not None else []
        return result

    try:
        root = ET.fromstring(processed_xml)
    except ET.ParseError:
        return {character: []}

    part = root.find(".//part")
    return {character: list(part.findall("measure")) if part is not None else []}
