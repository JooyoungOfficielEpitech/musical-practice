"""Persistent homr worker pool — loads OMR models once per worker process.

Each homr CLI invocation pays ~3s of process startup plus model setup on top
of ~8s of actual inference. A long-lived ProcessPoolExecutor keeps homr's
models warm in N worker processes, so per-image cost drops to inference only.

run_homr (pipeline.omr_runner) routes through this pool when it is running
and falls back to the subprocess CLI otherwise, so tests and one-off scripts
need no pool.
"""

import logging
import multiprocessing as mp
import os
from concurrent.futures import ProcessPoolExecutor
from typing import Optional

log = logging.getLogger("omr.homr_pool")

# Leave headroom for segmentation/OCR threads and the main process.
DEFAULT_WORKERS = max(2, min(6, (os.cpu_count() or 4) - 2))
TASK_TIMEOUT_S = 300

_executor: Optional[ProcessPoolExecutor] = None


def _worker_init() -> None:
    """Import homr once per worker; silence its per-call stderr chatter."""
    import sys

    sys.stderr = open(os.devnull, "w")
    import homr.main  # noqa: F401  (heavy import — models init lazily on first task)


def _worker_process(image_path: str) -> tuple[bool, str]:
    """Run homr in-process on one image. Returns (ok, xml_or_error)."""
    try:
        from homr.main import ProcessingConfig, process_image
        from homr.music_xml_generator import XmlGeneratorArguments

        config = ProcessingConfig(
            enable_debug=False,
            enable_cache=False,
            write_staff_positions=False,
            read_staff_positions=False,
            selected_staff=-1,
            use_gpu_inference=False,
        )
        process_image(image_path, config, XmlGeneratorArguments(None, None, None))
        xml_file = os.path.splitext(image_path)[0] + ".musicxml"
        with open(xml_file, "r", encoding="utf-8") as fh:
            return True, fh.read()
    except Exception as exc:  # noqa: BLE001 — must cross the process boundary as data
        return False, f"{type(exc).__name__}: {exc}"


def start_pool(workers: Optional[int] = None) -> None:
    """Start the worker pool (idempotent)."""
    global _executor
    if _executor is not None:
        return
    n = workers or DEFAULT_WORKERS
    _executor = ProcessPoolExecutor(
        max_workers=n,
        mp_context=mp.get_context("spawn"),
        initializer=_worker_init,
    )
    log.info("homr worker pool started (%d workers)", n)


def shutdown_pool() -> None:
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def pool_running() -> bool:
    return _executor is not None


def run_homr_pooled(image_path: str) -> Optional[str]:
    """Process one image via the pool. Returns MusicXML string or None."""
    if _executor is None:
        return None
    try:
        future = _executor.submit(_worker_process, image_path)
        ok, payload = future.result(timeout=TASK_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — pool/timeout failures degrade to None
        log.error("homr pool task failed: %s", exc)
        return None
    if not ok:
        log.error("homr (pooled) failed: %s", payload[:200])
        return None
    return payload
