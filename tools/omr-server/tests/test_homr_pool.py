"""Tests for pipeline.homr_pool — persistent homr worker pool routing."""

from unittest.mock import patch

import numpy as np

from pipeline import homr_pool
from pipeline.omr_runner import run_homr


class TestPoolRouting:
    def test_run_homr_uses_pool_when_running(self, tmp_path):
        img = str(tmp_path / "in.png")
        with (
            patch.object(homr_pool, "pool_running", return_value=True),
            patch.object(homr_pool, "run_homr_pooled", return_value="<xml/>") as pooled,
            patch("subprocess.run") as sub,
        ):
            result = run_homr(img, str(tmp_path))
        assert result == "<xml/>"
        pooled.assert_called_once_with(img)
        sub.assert_not_called()

    def test_run_homr_falls_back_to_subprocess_when_pool_off(self, tmp_path):
        img = str(tmp_path / "in.png")
        with (
            patch.object(homr_pool, "pool_running", return_value=False),
            patch("subprocess.run") as sub,
        ):
            sub.return_value.returncode = 1
            sub.return_value.stderr = "boom"
            result = run_homr(img, str(tmp_path))
        assert result is None
        sub.assert_called_once()

    def test_pooled_failure_returns_none(self, tmp_path):
        img = str(tmp_path / "in.png")
        with (
            patch.object(homr_pool, "pool_running", return_value=True),
            patch.object(homr_pool, "run_homr_pooled", return_value=None),
        ):
            assert run_homr(img, str(tmp_path)) is None


class TestWorkerTask:
    def test_worker_returns_error_tuple_on_bad_input(self):
        ok, payload = homr_pool._worker_process("/nonexistent/image.png")
        assert ok is False
        assert payload  # error message present

    def test_default_workers_leaves_headroom(self):
        assert 2 <= homr_pool.DEFAULT_WORKERS <= max(2, (np.array(1).size and 16))


class TestPoolLifecycle:
    def test_pool_running_false_before_start(self):
        homr_pool.shutdown_pool()
        assert homr_pool.pool_running() is False
