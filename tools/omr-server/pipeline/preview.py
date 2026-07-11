"""Page-1 preview JPEG generation for library thumbnails.

The app shows each score as a wide, short card image. A naive full-page
thumbnail of sheet music reads as a blank white box (scores are mostly
margin), so the preview crops to the ink bounding box and takes the top
slice at the card's aspect ratio — the first systems of actual music.
"""
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)

PREVIEW_WIDTH = 640
JPEG_QUALITY = 80
# Output width:height — matches the library card image (screen width x ~140pt).
PREVIEW_ASPECT = 2.0
# Pixels darker than this count as ink when locating content.
INK_THRESHOLD = 240
# Padding around the detected content box, as a fraction of its size.
CONTENT_PAD = 0.03


def _content_box(gray: np.ndarray) -> tuple[int, int, int, int] | None:
    """(x0, y0, x1, y1) bounding box of ink, or None for a blank page."""
    ink_rows = np.flatnonzero((gray < INK_THRESHOLD).any(axis=1))
    ink_cols = np.flatnonzero((gray < INK_THRESHOLD).any(axis=0))
    if ink_rows.size == 0 or ink_cols.size == 0:
        return None
    y0, y1 = int(ink_rows[0]), int(ink_rows[-1]) + 1
    x0, x1 = int(ink_cols[0]), int(ink_cols[-1]) + 1
    pad_y = round((y1 - y0) * CONTENT_PAD)
    pad_x = round((x1 - x0) * CONTENT_PAD)
    return (
        max(0, x0 - pad_x),
        max(0, y0 - pad_y),
        min(gray.shape[1], x1 + pad_x),
        min(gray.shape[0], y1 + pad_y),
    )


def make_preview_jpeg(
    png_path: str,
    width: int = PREVIEW_WIDTH,
    aspect: float = PREVIEW_ASPECT,
) -> bytes | None:
    """Content-cropped page thumbnail as JPEG bytes. None on any failure."""
    img = cv2.imread(png_path)
    if img is None:
        logger.warning("Preview: could not read %s", png_path)
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    box = _content_box(gray)
    if box is not None:
        x0, y0, x1, y1 = box
        img = img[y0:y1, x0:x1]

    # Top slice at the card aspect — the first systems of music.
    h, w = img.shape[:2]
    slice_h = round(w / aspect)
    if h > slice_h:
        img = img[:slice_h]

    h, w = img.shape[:2]
    if w != width:
        img = cv2.resize(
            img, (width, max(1, round(h * width / w))), interpolation=cv2.INTER_AREA
        )

    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    if not ok:
        logger.warning("Preview: JPEG encode failed for %s", png_path)
        return None
    return buf.tobytes()


def preview_storage_path(result_path: str) -> str:
    """Storage path of the preview living beside a MusicXML result."""
    if result_path.endswith(".musicxml"):
        result_path = result_path[: -len(".musicxml")]
    return f"{result_path}.preview.jpg"
