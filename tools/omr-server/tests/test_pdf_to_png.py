"""Tests for omr_io.pdf_to_png — PDF to PNG conversion."""

import os

import fitz  # PyMuPDF
import pytest

from omr_io.pdf_to_png import pdf_to_png


def _make_pdf(tmp_dir: str, n_pages: int) -> str:
    """Create a real synthetic PDF with n_pages using PyMuPDF."""
    path = os.path.join(tmp_dir, f"test_{n_pages}p.pdf")
    doc = fitz.open()
    for i in range(n_pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((100, 100), f"Page {i + 1}", fontsize=24)
    doc.save(path)
    doc.close()
    return path


class TestPdfToPng:
    def test_single_range_returns_correct_page_count(self, tmp_path):
        pdf = _make_pdf(str(tmp_path), 2)
        result = pdf_to_png(pdf, [(1, 2)], str(tmp_path))
        assert len(result) == 1
        assert len(result[0]) == 2

    def test_multiple_ranges_returns_correct_structure(self, tmp_path):
        pdf = _make_pdf(str(tmp_path), 2)
        result = pdf_to_png(pdf, [(1, 1), (2, 2)], str(tmp_path))
        assert len(result) == 2
        assert len(result[0]) == 1
        assert len(result[1]) == 1

    def test_empty_ranges_returns_all_pages(self, tmp_path):
        pdf = _make_pdf(str(tmp_path), 3)
        result = pdf_to_png(pdf, [], str(tmp_path))
        assert len(result) == 3
        for sub in result:
            assert len(sub) == 1

    def test_output_files_exist_on_disk(self, tmp_path):
        pdf = _make_pdf(str(tmp_path), 2)
        result = pdf_to_png(pdf, [(1, 2)], str(tmp_path))
        for path in result[0]:
            assert os.path.exists(path)

    def test_output_files_are_valid_png(self, tmp_path):
        pdf = _make_pdf(str(tmp_path), 2)
        result = pdf_to_png(pdf, [(1, 2)], str(tmp_path))
        for path in result[0]:
            with open(path, "rb") as f:
                header = f.read(4)
            assert header == b"\x89PNG"

    def test_page_out_of_bounds_raises_value_error(self, tmp_path):
        pdf = _make_pdf(str(tmp_path), 2)
        with pytest.raises(ValueError):
            pdf_to_png(pdf, [(1, 99)], str(tmp_path))

    def test_start_after_end_raises_value_error(self, tmp_path):
        pdf = _make_pdf(str(tmp_path), 3)
        with pytest.raises(ValueError):
            pdf_to_png(pdf, [(3, 1)], str(tmp_path))

    def test_missing_pdf_raises_file_not_found(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            pdf_to_png(str(tmp_path / "nonexistent.pdf"), [(1, 1)], str(tmp_path))

    def test_default_dpi_renders_at_300(self, tmp_path):
        """At 300 DPI a 595pt-wide PDF page renders to ~2479px wide."""
        import fitz, cv2
        pdf = _make_pdf(str(tmp_path), 1)
        result = pdf_to_png(pdf, [(1, 1)], str(tmp_path))
        img = cv2.imread(result[0][0])
        # 595pt * (300/72) = 2479px  — allow ±5px tolerance
        assert abs(img.shape[1] - 2479) <= 5

    def test_explicit_dpi_150_still_works(self, tmp_path):
        """Explicitly passing dpi=150 produces half-resolution output."""
        import fitz, cv2
        pdf = _make_pdf(str(tmp_path), 1)
        result = pdf_to_png(pdf, [(1, 1)], str(tmp_path), dpi=150)
        img = cv2.imread(result[0][0])
        # 595pt * (150/72) ≈ 1240px
        assert abs(img.shape[1] - 1240) <= 5
