"""Page-1 preview JPEG generation for library thumbnails.

The app shows each score as a card; without a preview image the card is an
empty gray box. The worker renders pages anyway, so the first page is
downscaled and uploaded beside the MusicXML result.
"""
import logging

import cv2

logger = logging.getLogger(__name__)

PREVIEW_WIDTH = 640
JPEG_QUALITY = 80


def make_preview_jpeg(png_path: str, width: int = PREVIEW_WIDTH) -> bytes | None:
    """Downscale a rendered page PNG to a small JPEG. None on any failure."""
    img = cv2.imread(png_path)
    if img is None:
        logger.warning("Preview: could not read %s", png_path)
        return None
    h, w = img.shape[:2]
    if w > width:
        img = cv2.resize(
            img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA
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
