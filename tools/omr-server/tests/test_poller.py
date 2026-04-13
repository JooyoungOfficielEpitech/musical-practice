"""Tests for omr_queue/poller.py — job claiming, processing, status updates."""
import pytest
from unittest.mock import MagicMock, patch


PENDING_JOB = {
    "id": "job-abc",
    "status": "pending",
    "pdf_storage_path": "omr-pdfs/job-abc.pdf",
    "page_ranges": [[1, 1]],
}


def _make_select_client(job=None):
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = (
        [job] if job else []
    )
    return client


class TestPollOnce:
    def test_returns_false_when_no_pending_jobs(self):
        client = _make_select_client(job=None)

        from omr_queue.poller import poll_once
        assert poll_once(client) is False

    def test_returns_true_when_job_found_and_processed(self):
        client = _make_select_client(job=PENDING_JOB)

        with patch("omr_queue.poller.process_job", return_value="job-abc.musicxml"):
            from omr_queue.poller import poll_once
            assert poll_once(client) is True

    def test_marks_job_processing_before_process_job_is_called(self):
        client = _make_select_client(job=PENDING_JOB)
        call_order = []

        def track_update(data):
            call_order.append(("update", data.get("status")))
            m = MagicMock()
            m.eq.return_value.execute.return_value.data = []
            return m

        client.table.return_value.update.side_effect = track_update

        def fake_process(job, c):
            call_order.append(("process", None))
            return "result.musicxml"

        with patch("omr_queue.poller.process_job", side_effect=fake_process):
            from omr_queue.poller import poll_once
            poll_once(client)

        update_statuses = [s for name, s in call_order if name == "update"]
        assert update_statuses[0] == "processing"

    def test_marks_job_done_with_result_path_on_success(self):
        client = _make_select_client(job=PENDING_JOB)
        update_calls = []

        def track_update(data):
            update_calls.append(data)
            return client.table.return_value.update.return_value

        client.table.return_value.update.side_effect = track_update

        with patch("omr_queue.poller.process_job", return_value="job-abc.musicxml"):
            from omr_queue.poller import poll_once
            poll_once(client)

        done_call = next((c for c in update_calls if c.get("status") == "done"), None)
        assert done_call is not None
        assert done_call["result_storage_path"] == "job-abc.musicxml"

    def test_marks_job_failed_on_omr_queue_error(self):
        client = _make_select_client(job=PENDING_JOB)
        update_calls = []

        def track_update(data):
            update_calls.append(data)
            return client.table.return_value.update.return_value

        client.table.return_value.update.side_effect = track_update

        from omr_queue.errors import OmrQueueError
        with patch("omr_queue.poller.process_job", side_effect=OmrQueueError("boom")):
            from omr_queue.poller import poll_once
            poll_once(client)

        failed_call = next((c for c in update_calls if c.get("status") == "failed"), None)
        assert failed_call is not None
        assert "boom" in failed_call["error"]
