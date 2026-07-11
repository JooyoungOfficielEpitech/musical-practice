"""Tests for pipeline.preview — page-1 library thumbnail generation."""
import cv2
import numpy as np
import pytest

from pipeline.preview import make_preview_jpeg, preview_storage_path, PREVIEW_ASPECT


def _decode(data: bytes):
    return cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)


@pytest.fixture()
def score_page(tmp_path):
    """A 2000x2800 mostly-white 'score page': content lives at y 900-2400.

    Mimics a real score PDF — big white margins around the music, so a naive
    full-page thumbnail looks like a blank white box.
    """
    img = np.full((2800, 2000, 3), 255, dtype=np.uint8)
    for y in range(900, 2400, 120):  # staff-ish dark lines
        img[y : y + 4, 200:1800] = 0
    path = str(tmp_path / "page.png")
    cv2.imwrite(path, img)
    return path


def test_returns_jpeg_bytes(score_page):
    data = make_preview_jpeg(score_page)
    assert data is not None
    assert data[:2] == b"\xff\xd8"


def test_crops_away_white_margins(score_page):
    """The preview must start at the music, not the blank page top."""
    img = _decode(make_preview_jpeg(score_page, width=640))
    # Top rows of the preview should contain ink (dark pixels) near the top —
    # content starts at y=900 of 2800, so a full-page preview would have ~32%
    # blank header. Require ink within the top 15% instead.
    top = img[: max(1, int(img.shape[0] * 0.15))]
    assert (top < 128).any(), "preview top is blank — margins were not cropped"


def test_output_is_target_width_and_aspect(score_page):
    img = _decode(make_preview_jpeg(score_page, width=640))
    assert img.shape[1] == 640
    # Content region is 1600 wide x 1500 tall (taller than aspect) → the
    # preview is a top slice at the target aspect ratio.
    assert img.shape[0] == round(640 / PREVIEW_ASPECT)


def test_short_content_keeps_full_height(tmp_path):
    """Content shorter than the target aspect: keep it all, don't stretch."""
    img = np.full((1000, 2000, 3), 255, dtype=np.uint8)
    img[450:550, 100:1900] = 0  # single thin band
    path = str(tmp_path / "short.png")
    cv2.imwrite(path, img)

    out = _decode(make_preview_jpeg(path, width=640))
    assert out.shape[1] == 640
    # Cropped content ≈ 100px tall + padding, scaled to 640 wide → well under
    # the aspect-slice height.
    assert out.shape[0] < round(640 / PREVIEW_ASPECT)


def test_blank_page_falls_back_to_full_page(tmp_path):
    img = np.full((1400, 1000, 3), 255, dtype=np.uint8)
    path = str(tmp_path / "blank.png")
    cv2.imwrite(path, img)

    data = make_preview_jpeg(path, width=500)
    assert data is not None
    out = _decode(data)
    assert out.shape[1] == 500


def test_returns_none_for_unreadable_path(tmp_path):
    assert make_preview_jpeg(str(tmp_path / "missing.png")) is None


def test_preview_storage_path_maps_result_path():
    assert (
        preview_storage_path("user-123/job-abc.musicxml")
        == "user-123/job-abc.preview.jpg"
    )


def test_preview_storage_path_without_musicxml_suffix():
    assert preview_storage_path("user/job") == "user/job.preview.jpg"
