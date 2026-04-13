"""Integration tests for main.py — /health and /omr endpoint behaviour."""

import base64
import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient


def _make_score_png_b64(n_systems: int = 2, staves_per_system: int = 3) -> str:
    """Create a minimal synthetic score PNG and return as base64 string."""
    width = 800
    staff_spacing = 12
    lines_per_staff = 5
    staff_height = (lines_per_staff - 1) * staff_spacing
    intra_gap = 40
    inter_gap = 120
    top_margin = 60

    system_height = staves_per_system * staff_height + (staves_per_system - 1) * intra_gap
    total_height = top_margin + n_systems * system_height + (n_systems - 1) * inter_gap + top_margin

    img = np.full((total_height, width, 3), 255, dtype=np.uint8)
    y = top_margin
    for _ in range(n_systems):
        for _ in range(staves_per_system):
            for line in range(lines_per_staff):
                cv2.line(img, (20, y + line * staff_spacing), (width - 20, y + line * staff_spacing), (0, 0, 0), 2)
            y += staff_height + intra_gap
        y -= intra_gap
        y += inter_gap

    _, buf = cv2.imencode(".png", img)
    return base64.b64encode(buf.tobytes()).decode()


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


class TestHealthEndpoint:
    def test_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestOmrEndpointValidation:
    def test_invalid_base64_returns_failure(self, client):
        resp = client.post("/omr", json={"image": "!!not-base64!!"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] != ""

    def test_valid_image_returns_response_shape(self, client):
        """Smoke test: valid image goes through pipeline, returns correct shape.

        Note: homr is not available in CI, so we only verify the response
        structure — not that OMR succeeded.
        """
        b64 = _make_score_png_b64()
        resp = client.post("/omr", json={"image": b64})
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "error" in data
        assert "musicxml" in data
        assert "attempts" in data
        assert "best_score" in data
        assert "strategy" in data


def _make_minimal_pdf_b64(n_pages: int) -> str:
    """Create a real minimal PDF with n_pages using PyMuPDF, return base64."""
    import fitz

    doc = fitz.open()
    for i in range(n_pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((100, 100), f"Page {i + 1}", fontsize=24)
    pdf_bytes = doc.tobytes()
    doc.close()
    return base64.b64encode(pdf_bytes).decode()


class TestPdfChunksEndpoint:
    def test_empty_ranges_returns_all_pages(self, client):
        pdf_b64 = _make_minimal_pdf_b64(2)
        resp = client.post("/pdf-chunks", json={"pdf_b64": pdf_b64, "page_ranges": []})
        assert resp.status_code == 200
        data = resp.json()
        assert "chunks" in data
        assert len(data["chunks"]) == 2
        for chunk in data["chunks"]:
            assert len(chunk) == 1
            assert isinstance(chunk[0], str)

    def test_explicit_range_returns_correct_chunk_count(self, client):
        pdf_b64 = _make_minimal_pdf_b64(2)
        resp = client.post("/pdf-chunks", json={"pdf_b64": pdf_b64, "page_ranges": [[1, 2]]})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["chunks"]) == 1
        assert len(data["chunks"][0]) == 2

    def test_invalid_base64_returns_error(self, client):
        resp = client.post("/pdf-chunks", json={"pdf_b64": "notbase64!!!", "page_ranges": []})
        assert resp.status_code != 200

    def test_page_out_of_bounds_returns_422(self, client):
        pdf_b64 = _make_minimal_pdf_b64(2)
        resp = client.post("/pdf-chunks", json={"pdf_b64": pdf_b64, "page_ranges": [[1, 99]]})
        assert resp.status_code == 422
