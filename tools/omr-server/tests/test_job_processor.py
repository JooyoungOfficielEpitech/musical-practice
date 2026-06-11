"""Tests for omr_queue/job_processor.py — download, OMR, upload cycle."""
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from unittest.mock import patch, MagicMock
import xml.etree.ElementTree as ET
import numpy as np


SAMPLE_JOB = {
    "id": "job-123",
    "pdf_storage_path": "omr-pdfs/job-123.pdf",
    "page_ranges": [[1, 2]],
    "score_type": "piano_vocal",
}

SAMPLE_XML = '<?xml version="1.0"?><score-partwise version="3.1"><part-list/><part id="P1"/></score-partwise>'

# A minimal measure list returned by _process_simple_page mock
def _make_measure_list():
    root = ET.fromstring(
        '<?xml version="1.0"?><score-partwise version="3.1"><part-list/>'
        '<part id="P1"><measure number="1"><note><rest/><duration>4</duration></note></measure>'
        '</part></score-partwise>'
    )
    part = root.find(".//part")
    return list(part.findall("measure"))


def _make_mock_client(pdf_bytes: bytes = b"%PDF-1.4 fake") -> MagicMock:
    client = MagicMock()
    client.storage.from_.return_value.download.return_value = pdf_bytes
    client.storage.from_.return_value.upload.return_value = {"path": "omr-results/job-123.musicxml"}
    return client


class TestProcessJob:
    def test_downloads_pdf_from_correct_bucket_and_path(self, tmp_path):
        client = _make_mock_client()

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[[str(tmp_path / "p1.png")]]),
            patch("omr_queue.job_processor._process_simple_page", return_value=_make_measure_list()),
        ):
            from omr_queue.job_processor import process_job
            process_job(SAMPLE_JOB, client)

        client.storage.from_.assert_any_call("omr-pdfs")
        client.storage.from_.return_value.download.assert_called_once_with("omr-pdfs/job-123.pdf")

    def test_uploads_result_to_omr_results_bucket(self, tmp_path):
        client = _make_mock_client()

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[[str(tmp_path / "p1.png")]]),
            patch("omr_queue.job_processor._process_simple_page", return_value=_make_measure_list()),
        ):
            from omr_queue.job_processor import process_job
            result_path = process_job(SAMPLE_JOB, client)

        client.storage.from_.assert_any_call("omr-results")
        upload_call = client.storage.from_.return_value.upload
        upload_call.assert_called_once()
        assert upload_call.call_args[0][0] == "job-123.musicxml"
        assert result_path == "job-123.musicxml"

    def test_raises_omr_queue_error_on_storage_download_failure(self):
        client = MagicMock()
        client.storage.from_.return_value.download.side_effect = Exception("storage error")

        from omr_queue.errors import OmrQueueError
        from omr_queue.job_processor import process_job

        with pytest.raises(OmrQueueError, match="storage error"):
            process_job(SAMPLE_JOB, client)

    def test_raises_omr_queue_error_when_no_pages_readable(self, tmp_path):
        client = _make_mock_client()

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[[str(tmp_path / "p1.png")]]),
            patch("omr_queue.job_processor.cv2.imread", return_value=None),
        ):
            from omr_queue.errors import OmrQueueError
            from omr_queue.job_processor import process_job

            with pytest.raises(OmrQueueError, match="no output"):
                process_job(SAMPLE_JOB, client)

    def test_processes_multiple_page_ranges(self, tmp_path):
        client = _make_mock_client()
        job = {**SAMPLE_JOB, "page_ranges": [[1, 1], [2, 2]], "score_type": "piano_vocal"}
        process_page_mock = MagicMock(return_value=_make_measure_list())

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[
                [str(tmp_path / "p1.png")],
                [str(tmp_path / "p2.png")],
            ]),
            patch("omr_queue.job_processor._process_simple_page", process_page_mock),
        ):
            from omr_queue.job_processor import process_job
            process_job(job, client)

        assert process_page_mock.call_count == 2


class TestSimplePipelineParallelism:
    def test_pages_processed_via_thread_pool(self, tmp_path):
        """_run_simple_pipeline uses ThreadPoolExecutor for page-level work."""
        client = _make_mock_client()
        job = {**SAMPLE_JOB, "page_ranges": [[1, 1], [2, 2]], "score_type": "piano_vocal"}

        call_threads = []

        def tracking_process(path, tmp_dir):
            call_threads.append(threading.current_thread().ident)
            return []  # empty measures

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[
                [str(tmp_path / "p1.png")],
                [str(tmp_path / "p2.png")],
            ]),
            patch("omr_queue.job_processor._process_simple_page", side_effect=tracking_process),
        ):
            from omr_queue.errors import OmrQueueError
            try:
                from omr_queue.job_processor import process_job
                process_job(job, client)
            except OmrQueueError:
                pass  # all pages returned [] so OmrQueueError is expected

        assert len(call_threads) == 2  # both pages were attempted

    def test_page_exception_does_not_abort_pipeline(self, tmp_path):
        """If one page raises, others still produce output."""
        client = _make_mock_client()
        PAGE_XML = (
            '<?xml version="1.0"?>'
            '<score-partwise version="3.1"><part-list/>'
            '<part id="P1">'
            '<measure number="1"><note><rest/><duration>4</duration></note></measure>'
            '</part></score-partwise>'
        )

        call_count = [0]

        def side_effect(path, tmp_dir):
            call_count[0] += 1
            if call_count[0] == 1:
                raise RuntimeError("page 1 failed")
            root = ET.fromstring(PAGE_XML)
            part = root.find(".//part")
            return list(part.findall("measure"))

        job = {**SAMPLE_JOB, "page_ranges": [[1, 1], [2, 2]], "score_type": "piano_vocal"}
        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[
                [str(tmp_path / "p1.png")],
                [str(tmp_path / "p2.png")],
            ]),
            patch("omr_queue.job_processor._process_simple_page", side_effect=side_effect),
        ):
            from omr_queue.job_processor import process_job
            result = process_job(job, client)  # should NOT raise
        assert result == "job-123.musicxml"


class TestOmrRunnerWorkerCap:
    def test_phase2_workers_scale_with_cpu(self):
        """Phase-2 ThreadPoolExecutor max_workers uses cpu_count // 2."""
        with patch("os.cpu_count", return_value=8):
            captured = []
            original_tpe = ThreadPoolExecutor

            class CapturingTPE(original_tpe):
                def __init__(self, max_workers=None, **kw):
                    captured.append(max_workers)
                    super().__init__(max_workers=max_workers, **kw)

            with (
                patch("pipeline.omr_runner.ThreadPoolExecutor", CapturingTPE),
                patch("pipeline.omr_runner._try_strategy", return_value=("name", None, 0.0, {})),
            ):
                from pipeline.omr_runner import run_best_strategy
                img = np.zeros((100, 100, 3), dtype=np.uint8)
                try:
                    run_best_strategy(img)
                except RuntimeError:
                    pass

            # With cpu_count=8: max_workers = max(1, min(4, 8//2)) = 4
            assert any(w == 4 for w in captured), f"expected 4 in {captured}"


class TestProgressReporting:
    """Phase 2A: progress_percent updates wired through both pipelines."""

    def test_process_job_reports_progress_during_processing(self, tmp_path):
        """P1: process_job calls progress update (progress_percent) at least once."""
        client = _make_mock_client()

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[[str(tmp_path / "p1.png")]]),
            patch("omr_queue.job_processor._process_simple_page", return_value=_make_measure_list()),
        ):
            from omr_queue.job_processor import process_job
            process_job(SAMPLE_JOB, client)

        update_calls = client.table.return_value.update.call_args_list
        progress_calls = [c for c in update_calls if "progress_percent" in c.args[0]]
        assert len(progress_calls) >= 1

    def test_simple_pipeline_reports_progress_per_page(self, tmp_path):
        """P2: simple pipeline reports increasing progress_percent for each page completed."""
        client = _make_mock_client()
        job = {**SAMPLE_JOB, "page_ranges": [[1, 1], [2, 2], [3, 3]], "score_type": "piano_vocal"}

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[
                [str(tmp_path / "p1.png")],
                [str(tmp_path / "p2.png")],
                [str(tmp_path / "p3.png")],
            ]),
            patch("omr_queue.job_processor._process_simple_page", return_value=_make_measure_list()),
        ):
            from omr_queue.job_processor import process_job
            process_job(job, client)

        update_calls = client.table.return_value.update.call_args_list
        pct_values = [c.args[0]["progress_percent"] for c in update_calls if "progress_percent" in c.args[0]]
        # At least 3 progress updates for 3 pages (one per page + final 95)
        assert len(pct_values) >= 3
        # All values must be positive integers in range 1–100
        assert all(1 <= v <= 100 for v in pct_values)

    def test_vocal_pipeline_reports_progress_per_page(self, tmp_path):
        """P3: vocal pipeline reports progress updates for each page sequentially."""
        client = _make_mock_client()
        job = {**SAMPLE_JOB, "score_type": "vocal_score", "page_ranges": [[1, 2]]}

        # Minimal char_sys / g_indices result from _process_vocal_page
        fake_char_sys = {"Soprano": {0: _make_measure_list()}}
        fake_g_indices = [0]

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[
                [str(tmp_path / "p1.png"), str(tmp_path / "p2.png")],
            ]),
            patch("omr_queue.vocal_pipeline._process_vocal_page", return_value=(fake_char_sys, fake_g_indices)),
            patch("omr_queue.vocal_pipeline.align_and_flatten", return_value={"Soprano": _make_measure_list()}),
            patch("omr_queue.vocal_pipeline.combine_chars_to_xml_string", return_value=SAMPLE_XML),
        ):
            from omr_queue.job_processor import process_job
            process_job(job, client)

        update_calls = client.table.return_value.update.call_args_list
        pct_values = [c.args[0]["progress_percent"] for c in update_calls if "progress_percent" in c.args[0]]
        # 2 pages → at least 2 per-page updates + 1 final (95) = 3 total
        assert len(pct_values) >= 3
        assert all(1 <= v <= 100 for v in pct_values)

    def test_reporter_failure_is_non_fatal(self, tmp_path):
        """P4: if progress update raises, process_job still completes successfully."""
        client = _make_mock_client()
        # Make the table().update().eq().execute() chain raise
        client.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception("DB down")

        with (
            patch("omr_queue.job_processor.pdf_to_png", return_value=[[str(tmp_path / "p1.png")]]),
            patch("omr_queue.job_processor._process_simple_page", return_value=_make_measure_list()),
        ):
            from omr_queue.job_processor import process_job
            result = process_job(SAMPLE_JOB, client)  # must NOT raise

        assert result == "job-123.musicxml"
