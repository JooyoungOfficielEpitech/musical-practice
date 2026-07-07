"""Run Audiveris (second OMR engine) on a full page image.

Audiveris complements homr on this repertoire: it reads dotted rhythms,
printed accidentals and whole-note chord octaves that homr misses, while
homr is stronger on beamed eighths and (with our preprocessing) x-noteheads.
The ensemble layer (pipeline.ensemble) merges the two conservatively.

Audiveris is an external Java app. When the binary is missing or a run
fails, callers receive None and the pipeline behaves exactly as before —
the ensemble is strictly additive.
"""

import glob
import logging
import os
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from typing import Optional

log = logging.getLogger("omr.audiveris")

AUDIVERIS_BIN = os.environ.get(
    "AUDIVERIS_BIN",
    os.path.expanduser("~/Applications/Audiveris.app/Contents/MacOS/Audiveris"),
)
RUN_TIMEOUT_S = 300


def audiveris_available() -> bool:
    return os.path.exists(AUDIVERIS_BIN)


def run_audiveris_page(page_png_path: str) -> Optional[ET.Element]:
    """Run Audiveris batch export on one page PNG.

    Returns the namespace-stripped <score-partwise> root, or None on any
    failure (missing binary, crash, timeout, no/unreadable output).
    """
    if not audiveris_available():
        return None
    try:
        with tempfile.TemporaryDirectory() as out_dir:
            result = subprocess.run(
                [AUDIVERIS_BIN, "-batch", "-export", "-output", out_dir, page_png_path],
                capture_output=True, text=True, timeout=RUN_TIMEOUT_S,
            )
            if result.returncode != 0:
                log.warning("audiveris failed (rc=%s): %s", result.returncode, result.stderr[:200])
                return None
            mxls = glob.glob(os.path.join(out_dir, "*.mxl"))
            if not mxls:
                log.warning("audiveris produced no .mxl for %s", page_png_path)
                return None
            with zipfile.ZipFile(mxls[0]) as z:
                names = [n for n in z.namelist() if n.endswith(".xml") and not n.startswith("META")]
                if not names:
                    return None
                data = z.read(names[0])
    except (subprocess.TimeoutExpired, OSError, zipfile.BadZipFile) as exc:
        log.warning("audiveris run failed for %s: %s", page_png_path, exc)
        return None
    try:
        return ET.fromstring(re.sub(rb'xmlns="[^"]*"', b"", data))
    except ET.ParseError as exc:
        log.warning("audiveris XML unparseable for %s: %s", page_png_path, exc)
        return None
