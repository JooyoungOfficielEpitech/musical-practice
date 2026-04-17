"""Process a single OMR job: download PDF → render PNGs → run OMR → upload MusicXML."""
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2
from supabase import Client

from core.staff_cropper import crop_all_vocal_staves, crop_vocal_staff, replace_x_noteheads
from omr_io.pdf_to_png import pdf_to_png
from omr_io.xml_writer import combine_chars_to_xml_string, merge_pages
from omr_queue.errors import OmrQueueError
from pipeline.alignment import align_and_flatten
from pipeline.omr_runner import process_single_staff, run_best_strategy

logger = logging.getLogger(__name__)

PDF_BUCKET = "omr-pdfs"
RESULT_BUCKET = "omr-results"

# Score types that require per-character staff isolation
_MULTI_CHAR_TYPES = {"vocal_score", "choral_satb"}


def _make_progress_reporter(client: Client, job_id: str):
    """Returns callable (pct: int) -> None that writes progress_percent to omr_jobs.

    Failures are logged but non-fatal — job processing continues regardless.
    """
    def report(pct: int) -> None:
        try:
            client.table("omr_jobs").update(
                {"progress_percent": pct}
            ).eq("id", job_id).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Progress update failed (non-fatal): %s", exc)
    return report


def process_job(job: dict, client: Client) -> str:
    """Download PDF, run OMR on each page range, upload combined MusicXML.

    Args:
        job: Row dict from omr_jobs with keys: id, pdf_storage_path, page_ranges, score_type.
        client: Authenticated Supabase client (service role).

    Returns:
        Storage path of the uploaded MusicXML result (e.g. "job-abc.musicxml").

    Raises:
        OmrQueueError: On any storage, rendering, or OMR failure.
    """
    job_id = job["id"]
    pdf_storage_path = job["pdf_storage_path"]
    page_ranges = [tuple(r) for r in job.get("page_ranges") or []]
    score_type = job.get("score_type") or "vocal_score"
    title = job.get("title") or "Untitled"

    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_bytes = _download_pdf(client, pdf_storage_path)
        local_pdf = os.path.join(tmp_dir, "input.pdf")
        with open(local_pdf, "wb") as fh:
            fh.write(pdf_bytes)

        chunks = pdf_to_png(local_pdf, page_ranges, tmp_dir)
        report_progress = _make_progress_reporter(client, job_id)

        if score_type in _MULTI_CHAR_TYPES:
            result_xml = _run_vocal_score_pipeline(chunks, tmp_dir, title, report_progress)
        else:
            result_xml = _run_simple_pipeline(chunks, tmp_dir, title, report_progress)

        result_path = f"{job_id}.musicxml"
        _upload_result(client, result_path, result_xml)

    return result_path


def _download_pdf(client: Client, storage_path: str) -> bytes:
    try:
        return client.storage.from_(PDF_BUCKET).download(storage_path)
    except Exception as exc:
        raise OmrQueueError(f"Failed to download PDF from storage: {exc}") from exc


def _process_vocal_page(
    png_path: str,
    tmp_dir: str,
    sys_offset: int,
) -> tuple[dict, list[int]]:
    """Process one page for vocal score pipeline.

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


def _run_vocal_score_pipeline(
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

    # Process pages sequentially to maintain deterministic sys_offset ordering
    # (character-level parallelism is inside _process_vocal_page)
    total_pages = len(all_pages)
    sys_offset = 0
    for page_idx, png_path in enumerate(all_pages):
        char_sys, g_indices = _process_vocal_page(png_path, tmp_dir, sys_offset)
        if report_progress and total_pages > 0:
            report_progress(round((page_idx + 1) / total_pages * 90))
        if g_indices:
            sys_offset = max(g_indices) + 1
        for char, sys_map in char_sys.items():
            all_known_chars.add(char)
            for g_idx, measures in sys_map.items():
                all_char_sys.setdefault(char, {})[g_idx] = measures
            for sub in _expand_compound(char):
                all_known_chars.add(sub)
        all_sys_indices.extend(g_indices)

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


def _process_simple_page(png_path: str, tmp_dir: str) -> list:
    """Process one page for the simple pipeline. Returns list of ET.Element measures."""
    import xml.etree.ElementTree as ET
    img = cv2.imread(png_path)
    if img is None:
        logger.warning("Could not read PNG: %s — skipping", png_path)
        return []
    cropped = crop_vocal_staff(img)
    if cropped is None:
        logger.warning("Staff crop failed for %s, using full image", png_path)
        cropped = img
    processed = replace_x_noteheads(cropped)
    try:
        xml_str, score, strategy = run_best_strategy(processed)
        logger.info("  Page OMR score=%.1f strategy=%s", score, strategy)
    except RuntimeError as exc:
        logger.warning("OMR failed for %s: %s — skipping", png_path, exc)
        return []
    try:
        root = ET.fromstring(xml_str)
        part = root.find(".//part")
        return list(part.findall("measure")) if part is not None else []
    except ET.ParseError as exc:
        logger.warning("XML parse error for %s: %s — skipping", png_path, exc)
        return []


def _run_simple_pipeline(
    chunks: list[list[str]],
    tmp_dir: str,
    title: str,
    report_progress=None,
) -> str:
    """Single-staff pipeline for piano_vocal / lead_sheet score types.

    Crops the top (vocal) staff from each system, runs multi-strategy OMR,
    and merges all pages into a single-part MusicXML.
    """
    all_pages = [path for chunk in chunks for path in chunk]
    total_pages = len(all_pages)
    max_workers = min(total_pages, os.cpu_count() or 4)
    page_measure_lists = []
    completed_count = 0
    with ThreadPoolExecutor(max_workers=max(1, max_workers)) as ex:
        futures = {ex.submit(_process_simple_page, p, tmp_dir): p for p in all_pages}
        for future in as_completed(futures):
            completed_count += 1
            if report_progress and total_pages > 0:
                report_progress(round(completed_count / total_pages * 90))
            try:
                measures = future.result()
                if measures:
                    page_measure_lists.append(measures)
            except Exception as exc:
                logger.warning("Page processing failed: %s — skipping", exc)

    if report_progress:
        report_progress(95)

    if not page_measure_lists:
        raise OmrQueueError("OMR produced no output — all pages failed or were unreadable")

    return merge_pages(page_measure_lists, title=title)


def _expand_compound(char_name: str) -> list[str]:
    """Return sub-voice names for compound labels, or [char_name] for simple ones."""
    COMPOUND_MAP = {"Co.SA": ["Soprano", "Alto"], "Co.TB": ["Tenor", "Bass"]}
    return COMPOUND_MAP.get(char_name, [char_name])


def _upload_result(client: Client, result_path: str, xml_content: str) -> None:
    try:
        client.storage.from_(RESULT_BUCKET).upload(
            result_path,
            xml_content.encode("utf-8"),
            {"content-type": "application/xml"},
        )
    except Exception as exc:
        raise OmrQueueError(f"Failed to upload result to storage: {exc}") from exc
