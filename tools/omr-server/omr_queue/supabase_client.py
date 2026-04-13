"""Supabase client factory for the OMR queue.

Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from the environment.
Raises OmrQueueError with a clear message if either variable is absent.
"""
import os
from supabase import create_client, Client
from omr_queue.errors import OmrQueueError


def get_supabase_client() -> Client:
    """Return an authenticated Supabase client using service-role credentials.

    Raises:
        OmrQueueError: If SUPABASE_URL or SUPABASE_SERVICE_KEY env vars are not set.
    """
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise OmrQueueError(
            "SUPABASE_URL environment variable is not set. "
            "Set it to your Supabase project URL before running the poller."
        )

    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        raise OmrQueueError(
            "SUPABASE_SERVICE_KEY environment variable is not set. "
            "Set it to your Supabase service role key before running the poller."
        )

    return create_client(url, key)
