"""OCR-based staff label detection: character names, SATB detection, fuzzy dedup."""

import logging
import re

import numpy as np

log = logging.getLogger("label_ocr")


def _measure_label_ink(
    gray: np.ndarray,
    staff: list[tuple[int, int]],
    staff_start_x: int,
) -> tuple[int, int, int]:
    """Measure dark-pixel ink in the label region left of the staff.

    Returns (dark_pixel_count, text_width_in_columns, text_start_x).
    text_start_x is -1 if no dark pixels are found.
    """
    staff_top = staff[0][0]
    staff_bottom = staff[-1][1]
    margin = 10
    y1 = max(0, staff_top - margin)
    y2 = min(gray.shape[0], staff_bottom + margin)
    x2 = max(staff_start_x, 10)
    label_region = gray[y1:y2, 0:x2]

    dark_mask = (label_region < 128).astype(np.uint8)
    dark_pixels = int(np.sum(dark_mask))
    col_proj = np.sum(dark_mask, axis=0)
    text_cols = int(np.sum(col_proj > 0))

    nz = np.nonzero(col_proj)[0]
    text_start_x = int(nz[0]) if len(nz) > 0 else -1

    return dark_pixels, text_cols, text_start_x


def _ocr_label_region(
    gray: np.ndarray,
    staff: list[tuple[int, int]],
    staff_start_x: int,
    ocr_engine,
) -> str | None:
    """Run OCR on the label region left of the staff to identify the character.

    Returns matched character name (e.g. "Elphaba", "Co.SA") or None
    if no label is found (accompaniment staff).
    """
    staff_top = staff[0][0]
    staff_bottom = staff[-1][1]
    margin = 15
    y1 = max(0, staff_top - margin)
    y2 = min(gray.shape[0], staff_bottom + margin)
    x2 = max(staff_start_x, 10)
    label_crop = gray[y1:y2, 0:x2]

    result = ocr_engine(label_crop)
    if not result or not result.txts:
        return None

    raw_text = " ".join(result.txts).strip()
    if not raw_text:
        return None

    text_lower = raw_text.lower()

    if "lead" in text_lower:
        return "Lead Sheet"

    worker_match = re.search(r'w\.?\s*(\d)', text_lower)
    if worker_match:
        return f"W.{worker_match.group(1)}"

    satb_letters = set()
    has_co = False
    for txt in result.txts:
        t = txt.strip().upper()
        if t in ("S", "A", "T", "B"):
            satb_letters.add(t)
        if re.match(r'co\.?$', txt.strip(), re.IGNORECASE):
            has_co = True

    if satb_letters:
        if {"S", "A"} & satb_letters:
            label = "Co.SA"
            log.debug(f"  OCR detected SATB label: '{label}' (from {satb_letters})")
            return label
        if {"T", "B"} & satb_letters:
            label = "Co.TB"
            log.debug(f"  OCR detected SATB label: '{label}' (from {satb_letters})")
            return label
    if has_co:
        log.debug("  OCR detected 'Co.' label")
        return "Co."

    cleaned = raw_text.strip().title()
    alpha_chars = sum(1 for c in cleaned if c.isalpha())
    has_period = "." in raw_text
    if alpha_chars <= 1 or (alpha_chars <= 2 and not has_period):
        log.debug(f"  OCR text too short/noisy, ignoring: '{raw_text}'")
        return None

    log.debug(f"  OCR detected label: '{cleaned}'")
    return cleaned


def _assign_labels_by_position(
    system_staff_indices: list[int],
    staves: list[list[tuple[int, int]]],
    gray: np.ndarray,
    character_names: list[str],
    staff_start_x: int,
    lead_sheet_staves: set[int] | None = None,
    ocr_engine=None,
) -> dict[int, str]:
    """Assign character labels to staves in a system.

    Uses OCR when available, falls back to positional assignment.

    Returns dict mapping staff_index -> character_name (labeled vocal staves only).
    """
    if lead_sheet_staves is None:
        lead_sheet_staves = set()

    assignments: dict[int, str] = {}

    if not system_staff_indices:
        return assignments

    if ocr_engine is not None:
        for staff_idx in system_staff_indices:
            if staff_idx in lead_sheet_staves:
                continue
            label = _ocr_label_region(gray, staves[staff_idx], staff_start_x, ocr_engine)
            if label == "Lead Sheet":
                lead_sheet_staves.add(staff_idx)
                continue
            if label is not None:
                assignments[staff_idx] = label

        # Second pass: combined inter-staff regions for unlabeled adjacent staves
        unlabeled = [si for si in system_staff_indices
                     if si not in assignments and si not in lead_sheet_staves]
        i = 0
        while i < len(unlabeled) - 1:
            s1, s2 = unlabeled[i], unlabeled[i + 1]
            if abs(system_staff_indices.index(s1) - system_staff_indices.index(s2)) == 1:
                top = staves[s1][0][0]
                bottom = staves[s2][-1][1]
                margin = 15
                y1 = max(0, top - margin)
                y2 = min(gray.shape[0], bottom + margin)
                x2 = min(gray.shape[1], max(staff_start_x, 10) + 80)
                combined_crop = gray[y1:y2, 0:x2]
                result = ocr_engine(combined_crop)
                if result and result.txts:
                    has_s = "s" in [t.strip().lower() for t in result.txts]
                    has_a = "a" in [t.strip().lower() for t in result.txts]
                    has_t = "t" in [t.strip().lower() for t in result.txts]
                    has_b = "b" in [t.strip().lower() for t in result.txts]
                    has_co = any("co" in t.lower() for t in result.txts)
                    combined_text = " ".join(result.txts).strip().lower()
                    if (has_s or has_a) and (has_t or has_b or has_co):
                        assignments[s1] = "Co.SA"
                        assignments[s2] = "Co.TB"
                        i += 2
                        continue
                    elif has_co or "company" in combined_text:
                        assignments[s1] = "Co.SA"
                        assignments[s2] = "Co.TB"
                        i += 2
                        continue
            i += 1

        # Resolve ambiguous "Co." labels by position
        co_staves = sorted([si for si, lbl in assignments.items() if lbl == "Co."])
        if len(co_staves) >= 2:
            assignments[co_staves[0]] = "Co.SA"
            assignments[co_staves[1]] = "Co.TB"
            for extra in co_staves[2:]:
                idx = co_staves.index(extra)
                assignments[extra] = "Co.SA" if idx % 2 == 0 else "Co.TB"
        elif len(co_staves) == 1:
            idx = co_staves[0]
            pos = system_staff_indices.index(idx) if idx in system_staff_indices else 0
            vocal_count = len([si for si in system_staff_indices if si not in lead_sheet_staves])
            assignments[idx] = "Co.SA" if pos < vocal_count // 2 else "Co.TB"

        return assignments

    # Positional fallback (no OCR engine)
    if not character_names:
        return assignments

    vocal_indices = [i for i in system_staff_indices if i not in lead_sheet_staves]
    if not vocal_indices:
        return assignments

    if len(vocal_indices) == 1:
        staff_idx = vocal_indices[0]
        dark_pixels, _, _ = _measure_label_ink(gray, staves[staff_idx], staff_start_x)
        if len(character_names) >= 2:
            assignments[staff_idx] = character_names[1] if dark_pixels > 700 else character_names[0]
        else:
            assignments[staff_idx] = character_names[0]
        return assignments

    for pos, staff_idx in enumerate(vocal_indices):
        if pos < len(character_names):
            assignments[staff_idx] = character_names[pos]
        else:
            assignments[staff_idx] = f"W.{pos - len(character_names) + 1}"

    return assignments
