"""Tests for pipeline.preview — page-1 library thumbnail generation."""
import os

import cv2
import numpy as np
import pytest

from pipeline.preview import make_preview_jpeg, preview_storage_path


@pytest.fixture()
def wide_png(tmp_path):
    """A 2000x1500 white page with a black bar (so JPEG has content)."""
    img = np.full((1500, 2000, 3), 255, dtype=np.uint8)
    img[700:800, :] = 0
    path = str(tmp_path / "page.png")
    cv2.imwrite(path, img)
    return path


def test_make_preview_returns_jpeg_bytes(wide_png):
    data = make_preview_jpeg(wide_png)
    assert data is not None
    # JPEG magic number
    assert data[:2] == b"\xff\xd8"


def test_make_preview_downscales_to_target_width(wide_png, tmp_path):
    data = make_preview_jpeg(wide_png, width=640)
    out = str(tmp_path / "preview.jpg")
    with open(out, "wb") as fh:
        fh.write(data)
    img = cv2.imread(out)
    assert img.shape[1] == 640
    # Aspect ratio preserved: 1500 * 640/2000 = 480
    assert img.shape[0] == 480


def test_make_preview_keeps_small_images_unscaled(tmp_path):
    img = np.full((100, 200, 3), 128, dtype=np.uint8)
    path = str(tmp_path / "small.png")
    cv2.imwrite(path, img)

    data = make_preview_jpeg(path, width=640)
    out = str(tmp_path / "preview.jpg")
    with open(out, "wb") as fh:
        fh.write(data)
    assert cv2.imread(out).shape[:2] == (100, 200)


def test_make_preview_returns_none_for_unreadable_path(tmp_path):
    assert make_preview_jpeg(str(tmp_path / "missing.png")) is None


def test_preview_storage_path_maps_result_path():
    assert (
        preview_storage_path("user-123/job-abc.musicxml")
        == "user-123/job-abc.preview.jpg"
    )


def test_preview_storage_path_without_musicxml_suffix():
    assert preview_storage_path("user/job") == "user/job.preview.jpg"
