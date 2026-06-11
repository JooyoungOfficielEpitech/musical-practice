"""Staff image processing — page and per-staff OMR pipeline."""

import logging
import os
import tempfile
import xml.etree.ElementTree as ET
from typing import Optional

import cv2
import numpy as np

from core.voice_separator import separate_voices_image
from pipeline.chord_voicer import take_voice
from pipeline.postprocessor import postprocess as postprocess_musicxml
from pipeline.voice_splitter import split_voices
from pipeline.omr_runner import run_chord_strategy, run_homr

log = logging.getLogger("omr.staff_processor")


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


def _run_merged_best_strategy(processed: np.ndarray, tag: str) -> Optional[str]:
    """Run multi-strategy OMR on the merged compound-staff image.

    run_chord_strategy tries the preprocessing variants that measurably
    improve homr's chord recall and picks by chord count — chords carry the
    second voice's content. Already postprocessed. Returns None when every
    strategy fails.
    """
    try:
        xml, score, strategy = run_chord_strategy(processed)
        log.info(f"{tag}: merged best-strategy score={score:.1f} ({strategy})")
        return xml
    except RuntimeError as exc:
        log.warning(f"{tag}: merged best-strategy failed: {exc}")
        return None


def process_single_staff(
    character: str,
    staff_image: np.ndarray,
    system_idx: int,
    tmp_dir: str,
    output_dir: Optional[str] = None,
) -> dict[str, list[ET.Element]]:
    """Process one staff image through OMR pipeline.

    For compound SATB staves (Co.SA / Co.TB):
    1. Try separate_voices_image(staff_image).
    2. If result: run homr on up/down images separately.
    3. Per-voice fallback: if a voice yields 0 pitched notes, use
       the same voice from a merged-path run (cached to ≤1 call).
    4. If separation returns None: fall back to existing split_voices path.

    Returns dict mapping character name -> list of measure Elements.
    """
    from core.staff_cropper import replace_x_noteheads

    COMPOUND_VOICES = {"Co.SA": ("Soprano", "Alto"), "Co.TB": ("Tenor", "Bass")}
    safe_name = character.replace(" ", "_").replace(".", "")
    tag = f"{safe_name}_sys{system_idx}"

    if output_dir:
        cv2.imwrite(os.path.join(output_dir, f"{tag}_cropped.png"), staff_image)

    processed = replace_x_noteheads(staff_image)

    if character not in COMPOUND_VOICES:
        # Non-compound: existing path
        with tempfile.TemporaryDirectory() as _omr_dir:
            _img_path = os.path.join(_omr_dir, f"{tag}.png")
            cv2.imwrite(_img_path, processed)
            raw_xml = run_homr(_img_path, _omr_dir)
        if raw_xml is None:
            return {character: []}
        processed_xml = postprocess_musicxml(raw_xml)
        try:
            root = ET.fromstring(processed_xml)
        except ET.ParseError:
            return {character: []}
        part = root.find(".//part")
        return {character: list(part.findall("measure")) if part is not None else []}

    # Compound character: try voice separation
    v1_name, v2_name = COMPOUND_VOICES[character]
    sep_result = separate_voices_image(processed)

    if sep_result is None:
        # Separation not viable: merged multi-strategy OMR + split_voices.
        # Multi-strategy preprocessing maximises homr's chord recall, which is
        # what the chord-split assignment below depends on.
        log.info(f"{tag}: separation returned None, using merged split_voices path")
        processed_xml = _run_merged_best_strategy(processed, tag)
        if processed_xml is None:
            return {v1_name: [], v2_name: []}
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

    # Separation successful: run homr on up/down images
    log.info(
        f"{tag}: separated {sep_result.n_up} up, {sep_result.n_down} down, "
        f"{sep_result.n_ambiguous} ambiguous"
    )

    merged_attempted = False
    merged_voice_parts: Optional[dict[str, str]] = None
    result = {}

    for voice_img, voice_name, voice_idx in [
        (sep_result.up_img, v1_name, "up"),
        (sep_result.down_img, v2_name, "down"),
    ]:
        with tempfile.TemporaryDirectory() as _omr_dir:
            _img_path = os.path.join(_omr_dir, f"{tag}_{voice_idx}.png")
            cv2.imwrite(_img_path, voice_img)
            voice_xml = run_homr(_img_path, _omr_dir)

        if voice_xml is None:
            log.info(f"{tag} {voice_name}: homr failed, will use fallback")
        else:
            voice_xml = postprocess_musicxml(voice_xml)
            # Shared chords were kept in both images: keep the top line for
            # the up voice and the bottom line for the down voice.
            voice_xml = take_voice(voice_xml, "upper" if voice_idx == "up" else "lower")
            # Check if voice has pitched notes
            try:
                temp_root = ET.fromstring(voice_xml)
                pitched = temp_root.findall(".//pitch")
                if len(pitched) == 0:
                    log.info(f"{tag} {voice_name}: 0 pitched notes, will use fallback")
                    voice_xml = None
            except ET.ParseError:
                log.info(f"{tag} {voice_name}: unparseable XML, will use fallback")
                voice_xml = None

        if voice_xml is None:
            # Fallback: merged multi-strategy path, attempted at most once.
            if not merged_attempted:
                merged_attempted = True
                log.info(f"{tag}: running merged path for fallback")
                merged_xml = _run_merged_best_strategy(processed, tag)
                if merged_xml is not None:
                    merged_voice_parts = split_voices(merged_xml)
            if merged_voice_parts is None:
                result[voice_name] = []
                continue
            voice_xml = merged_voice_parts.get("voice1" if voice_idx == "up" else "voice2")
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
