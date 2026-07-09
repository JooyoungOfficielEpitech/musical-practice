"""Process a single OMR job: download PDF → render PNGs → run OMR → upload MusicXML."""
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2
from supabase import Client

from core.staff_cropper import crop_vocal_staff, replace_x_noteheads
from omr_io.pdf_to_png import pdf_to_png
from omr_io.xml_writer import merge_pages
from omr_queue.errors import OmrQueueError
from omr_queue.vocal_pipeline import run_vocal_score_pipeline
from pipeline.omr_runner import run_best_strategy
from pipeline.preview import make_preview_jpeg, preview_storage_path

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
            result_xml = run_vocal_score_pipeline(chunks, tmp_dir, title, report_progress)
        else:
            result_xml = _run_simple_pipeline(chunks, tmp_dir, title, report_progress)

        # Prefix with the owning user's ID so client RLS (omr_results_select,
        # path-scoped to auth.uid()) can download the result.
        user_id = job.get("user_id")
        result_path = f"{user_id}/{job_id}.musicxml" if user_id else f"{job_id}.musicxml"
        _upload_result(client, result_path, result_xml)

        first_png = chunks[0][0] if chunks and chunks[0] else None
        _upload_preview(client, result_path, first_png)

    return result_path


def _download_pdf(client: Client, storage_path: str) -> bytes:
    try:
        return client.storage.from_(PDF_BUCKET).download(storage_path)
    except Exception as exc:
        raise OmrQueueError(f"Failed to download PDF from storage: {exc}") from exc


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
    processed, x_positions, staff_width = replace_x_noteheads(cropped)
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


def _upload_preview(client: Client, result_path: str, png_path: str | None) -> None:
    """Upload a page-1 thumbnail beside the result. Failures are non-fatal."""
    if not png_path:
        return
    try:
        data = make_preview_jpeg(png_path)
        if data is None:
            return
        client.storage.from_(RESULT_BUCKET).upload(
            preview_storage_path(result_path),
            data,
            {"content-type": "image/jpeg", "upsert": "true"},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Preview upload failed (non-fatal): %s", exc)


def _upload_result(client: Client, result_path: str, xml_content: str) -> None:
    try:
        client.storage.from_(RESULT_BUCKET).upload(
            result_path,
            xml_content.encode("utf-8"),
            # upsert: a reprocessed job re-uploads to the same path; without it
            # storage returns 409 Duplicate after all the OMR work is done.
            {"content-type": "application/xml", "upsert": "true"},
        )
    except Exception as exc:
        raise OmrQueueError(f"Failed to upload result to storage: {exc}") from exc
