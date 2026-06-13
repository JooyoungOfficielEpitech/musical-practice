"""Multi-character vocal score pipeline: OCR label detection + system alignment."""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2

from core.staff_cropper import crop_all_vocal_staves
from omr_io.xml_writer import combine_chars_to_xml_string
from omr_queue.errors import OmrQueueError
from pipeline.alignment import align_and_flatten
from pipeline.staff_processor import process_single_staff

logger = logging.getLogger(__name__)

# Pages processed concurrently; with up to 4 staff workers inside each page
# this keeps the homr worker pool saturated without flooding it.
PAGE_WORKERS = 2


def _expand_compound(char_name: str) -> list[str]:
    """Return sub-voice names for compound labels, or [char_name] for simple ones."""
    COMPOUND_MAP = {"Co.SA": ["Soprano", "Alto"], "Co.TB": ["Tenor", "Bass"]}
    return COMPOUND_MAP.get(char_name, [char_name])


def _process_vocal_page(
    png_path: str,
    tmp_dir: str,
    sys_offset: int,
) -> tuple[dict, list[int]]:
    """Process one page for the vocal score pipeline.

    Returns (char_sys_measures, global_sys_indices) where
    char_sys_measures is {char_name: {global_sys_idx: [measures]}}.
    """
    img = cv2.imread(png_path)
    if img is None:
        logger.warning("Could not read PNG: %s — skipping", png_path)
        return {}, []

    staves_dict, _ = crop_all_vocal_staves(img)
    if not staves_dict:
        logger.warning("No vocal staves detected in %s — skipping", png_path)
        return {}, []

    local_sys = sorted({s for staves in staves_dict.values() for _, s in staves})
    local_to_global = {s: sys_offset + i for i, s in enumerate(local_sys)}
    global_indices = [local_to_global[s] for s in local_sys]

    # Build work list: (char, staff_img, global_sys_idx)
    work = [
        (char, staff_img, local_to_global[local_s])
        for char, stave_list in staves_dict.items()
        for staff_img, local_s in stave_list
    ]

    char_sys: dict[str, dict[int, list]] = {}
    char_workers = max(1, min(len(staves_dict), 4))
    with ThreadPoolExecutor(max_workers=char_workers) as ex:
        futures = {
            ex.submit(process_single_staff, char, img, g_idx, tmp_dir): (char, g_idx)
            for char, img, g_idx in work
        }
        for future in as_completed(futures):
            try:
                result = future.result()
                for sub_char, measures in result.items():
                    char_sys.setdefault(sub_char, {})[futures[future][1]] = measures
            except Exception as exc:
                logger.warning("Staff processing failed: %s — skipping", exc)

    return char_sys, global_indices


def run_vocal_score_pipeline(
    chunks: list[list[str]],
    tmp_dir: str,
    title: str,
    report_progress=None,
) -> str:
    """Full multi-character pipeline: OCR label detection + system-level alignment.

    For each page, detects individual character staves via OCR, runs OMR per
    character per system (parallelised), then aligns all characters temporally
    so absent characters get rest padding. Produces multi-part MusicXML.
    """
    all_pages = [path for chunk in chunks for path in chunk]
    all_char_sys: dict[str, dict[int, list]] = {}
    all_known_chars: set[str] = set()
    all_sys_indices: list[int] = []

    # Pages run concurrently with LOCAL system indices; global offsets are
    # assigned afterwards in page order, so temporal alignment stays
    # deterministic regardless of completion order.
    total_pages = len(all_pages)
    page_results: list[tuple[dict, list[int]] | None] = [None] * total_pages
    completed = 0
    with ThreadPoolExecutor(max_workers=min(total_pages, PAGE_WORKERS)) as ex:
        futures = {
            ex.submit(_process_vocal_page, png_path, tmp_dir, 0): page_idx
            for page_idx, png_path in enumerate(all_pages)
        }
        for future in as_completed(futures):
            page_idx = futures[future]
            try:
                page_results[page_idx] = future.result()
            except Exception as exc:
                logger.warning("Page %d failed: %s — skipping", page_idx + 1, exc)
                page_results[page_idx] = ({}, [])
            completed += 1
            if report_progress and total_pages > 0:
                report_progress(round(completed / total_pages * 90))

    sys_offset = 0
    for char_sys, local_indices in (r for r in page_results if r is not None):
        for char, sys_map in char_sys.items():
            all_known_chars.add(char)
            for local_idx, measures in sys_map.items():
                all_char_sys.setdefault(char, {})[sys_offset + local_idx] = measures
            for sub in _expand_compound(char):
                all_known_chars.add(sub)
        all_sys_indices.extend(sys_offset + i for i in local_indices)
        if local_indices:
            sys_offset += max(local_indices) + 1

    if report_progress:
        report_progress(95)

    if not all_known_chars:
        raise OmrQueueError("No characters detected across all pages")

    # System-by-system temporal alignment
    char_flat = align_and_flatten(all_char_sys, all_known_chars, all_sys_indices)

    # Drop characters with zero measures after alignment
    char_flat = {c: m for c, m in char_flat.items() if m}
    if not char_flat:
        raise OmrQueueError("OMR produced no measures — all characters empty after alignment")

    return combine_chars_to_xml_string(char_flat, title=title)
