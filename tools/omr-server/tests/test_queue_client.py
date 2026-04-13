"""Tests for omr_queue/supabase_client.py — env-var init and error on missing config."""
import pytest
from unittest.mock import patch, MagicMock


class TestGetSupabaseClient:
    def test_raises_omr_queue_error_when_url_missing(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)

        from omr_queue.errors import OmrQueueError
        from omr_queue.supabase_client import get_supabase_client

        with pytest.raises(OmrQueueError, match="SUPABASE_URL"):
            get_supabase_client()

    def test_raises_omr_queue_error_when_key_missing(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)

        from omr_queue.errors import OmrQueueError
        from omr_queue.supabase_client import get_supabase_client

        with pytest.raises(OmrQueueError, match="SUPABASE_SERVICE_KEY"):
            get_supabase_client()

    def test_returns_client_when_vars_set(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_KEY", "service-key-abc")

        mock_client = MagicMock()
        with patch("omr_queue.supabase_client.create_client", return_value=mock_client):
            from omr_queue.supabase_client import get_supabase_client
            result = get_supabase_client()

        assert result is mock_client
