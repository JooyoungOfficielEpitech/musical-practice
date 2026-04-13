"""Supabase polling loop — claims pending OMR jobs and processes them."""
import logging
import time

from supabase import Client

from omr_queue.errors import OmrQueueError
from omr_queue.job_processor import process_job

logger = logging.getLogger(__name__)

TABLE = "omr_jobs"


def poll_once(client: Client) -> bool:
    """Claim and process one pending job.

    Uses a SELECT + UPDATE pattern to claim a job atomically:
    only rows where status='pending' are selected, then immediately
    marked 'processing' before processing starts.

    Returns:
        True if a job was found and processed (or failed), False if queue empty.
    """
    result = (
        client.table(TABLE)
        .select("*")
        .eq("status", "pending")
        .limit(1)
        .execute()
    )

    if not result.data:
        return False

    job = result.data[0]
    job_id = job["id"]
    logger.info("Claiming job %s", job_id)

    # Mark processing before doing any work
    client.table(TABLE).update({"status": "processing"}).eq("id", job_id).execute()

    try:
        result_path = process_job(job, client)
        client.table(TABLE).update({
            "status": "done",
            "result_storage_path": result_path,
        }).eq("id", job_id).execute()
        logger.info("Job %s done — result at %s", job_id, result_path)
    except OmrQueueError as exc:
        client.table(TABLE).update({
            "status": "failed",
            "error": str(exc),
        }).eq("id", job_id).execute()
        logger.error("Job %s failed: %s", job_id, exc)

    return True


def run_poll_loop(interval_seconds: float = 5.0) -> None:
    """Poll for pending jobs in a loop until interrupted.

    Args:
        interval_seconds: Seconds to wait between polls when queue is empty.
    """
    from omr_queue.supabase_client import get_supabase_client

    client = get_supabase_client()
    logger.info("Poller started — checking every %.1fs", interval_seconds)

    while True:
        try:
            found = poll_once(client)
            if not found:
                time.sleep(interval_seconds)
        except KeyboardInterrupt:
            logger.info("Poller stopped.")
            break
        except Exception as exc:
            logger.error("Unexpected poller error: %s", exc, exc_info=True)
            time.sleep(interval_seconds)
