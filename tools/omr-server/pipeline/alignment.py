"""System-by-system temporal alignment and multi-page merging for multi-part scores."""

import logging
import xml.etree.ElementTree as ET

import numpy as np

log = logging.getLogger("omr.alignment")


def stitch_staves(
    staff_images: list[np.ndarray],
    separator_height: int = 20,
) -> np.ndarray:
    """Stitch multiple staff images vertically with a white separator."""
    if not staff_images:
        raise ValueError("No staff images to stitch")

    max_w = max(img.shape[1] for img in staff_images)
    channels = staff_images[0].shape[2] if staff_images[0].ndim == 3 else None

    parts = []
    for i, img in enumerate(staff_images):
        if i > 0:
            sep_shape = (separator_height, max_w)
            if channels:
                sep_shape += (channels,)
            parts.append(np.full(sep_shape, 255, dtype=np.uint8))

        if img.shape[1] < max_w:
            pad_w = max_w - img.shape[1]
            pad_shape = (img.shape[0], pad_w)
            if channels:
                pad_shape += (channels,)
            img = np.hstack([img, np.full(pad_shape, 255, dtype=np.uint8)])

        parts.append(img)

    return np.vstack(parts)


def merge_character_pages(
    character: str,
    all_page_measures: list[list[ET.Element]],
    output_path: str,
    title: str = "Untitled",
    composer: str = "Unknown",
) -> None:
    """Merge measures from all pages for a single character into one MusicXML file.

    Args:
        character: Character name used as part name in output.
        all_page_measures: List of measure lists, one per page.
        output_path: File path for the output MusicXML.
        title: Work title metadata.
        composer: Composer metadata.
    """
    new_root = ET.Element("score-partwise")
    new_root.set("version", "3.1")

    work = ET.SubElement(new_root, "work")
    ET.SubElement(work, "work-title").text = title

    ident = ET.SubElement(new_root, "identification")
    creator = ET.SubElement(ident, "creator")
    creator.set("type", "composer")
    creator.text = composer

    pl = ET.SubElement(new_root, "part-list")
    sp = ET.SubElement(pl, "score-part")
    sp.set("id", "P1")
    ET.SubElement(sp, "part-name").text = character

    part = ET.SubElement(new_root, "part")
    part.set("id", "P1")

    measure_num = 0
    for page_measures in all_page_measures:
        for m in page_measures:
            measure_num += 1
            m.set("number", str(measure_num))

            if measure_num == 1:
                if m.find("attributes") is None:
                    attrs = ET.Element("attributes")
                    m.insert(0, attrs)
                    ET.SubElement(attrs, "divisions").text = "2"
                    key = ET.SubElement(attrs, "key")
                    ET.SubElement(key, "fifths").text = "0"
                    time = ET.SubElement(attrs, "time")
                    ET.SubElement(time, "beats").text = "4"
                    ET.SubElement(time, "beat-type").text = "4"
                    clef = ET.SubElement(attrs, "clef")
                    ET.SubElement(clef, "sign").text = "G"
                    ET.SubElement(clef, "line").text = "2"
            else:
                for attrs in m.findall("attributes"):
                    m.remove(attrs)
                for d in m.findall("direction"):
                    m.remove(d)

            part.append(m)

    result = ET.tostring(new_root, encoding="unicode", xml_declaration=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(result)

    log.info(f"Merged {measure_num} measures for {character} -> {output_path}")


def _make_rest_measure(divisions: int = 2, beats: int = 4) -> ET.Element:
    """Create a whole-rest measure element."""
    m = ET.Element("measure")
    note = ET.SubElement(m, "note")
    ET.SubElement(note, "rest")
    dur = ET.SubElement(note, "duration")
    dur.text = str(divisions * beats)
    ET.SubElement(note, "voice").text = "1"
    ET.SubElement(note, "type").text = "whole"
    return m


def align_and_flatten(
    char_sys_measures: dict[str, dict[int, list[ET.Element]]],
    all_known_chars: set[str],
    sys_indices: list[int],
) -> dict[str, list[ET.Element]]:
    """Apply system-level temporal alignment and return flat per-character measure lists.

    For each system, the maximum measure count across all present characters is used.
    Absent or short characters get padded with whole-rest measures so all characters
    stay in sync across the full score.

    Args:
        char_sys_measures: {char_name: {sys_idx: [measure_elements]}}
        all_known_chars: Every character name ever seen (including those absent this page).
        sys_indices: Ordered list of system indices to process.

    Returns:
        {char_name: [all_aligned_measures]} — flat list ready for merging.
    """
    result: dict[str, list[ET.Element]] = {c: [] for c in all_known_chars}

    for sys_idx in sys_indices:
        # Measure count for each char in this system
        counts = {
            c: len(char_sys_measures.get(c, {}).get(sys_idx, []))
            for c in all_known_chars
        }
        sys_max = max(counts.values()) if counts else 0
        if sys_max == 0:
            continue

        for char_name in all_known_chars:
            measures = list(char_sys_measures.get(char_name, {}).get(sys_idx, []))
            # Pad short/absent parts with rest measures
            while len(measures) < sys_max:
                measures.append(_make_rest_measure())
            result[char_name].extend(measures)

    log.info(
        "align_and_flatten: %d chars × %d systems → %s measures",
        len(all_known_chars),
        len(sys_indices),
        {c: len(v) for c, v in result.items()},
    )
    return result
