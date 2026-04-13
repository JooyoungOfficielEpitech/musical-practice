"""PDF to PNG conversion using PyMuPDF (fitz)."""

import os

import fitz


def _validate_ranges(
    page_ranges: list[tuple[int, int]],
    n_pages: int,
) -> None:
    """Raise ValueError if any range is invalid."""
    for start, end in page_ranges:
        if start > end:
            raise ValueError(
                f"Invalid range ({start}, {end}): start must be <= end."
            )
        if start < 1 or end > n_pages:
            raise ValueError(
                f"Range ({start}, {end}) out of bounds for PDF with {n_pages} page(s). "
                f"Pages are 1-indexed and must be <= {n_pages}."
            )


def pdf_to_png(
    pdf_path: str,
    page_ranges: list[tuple[int, int]],
    output_dir: str,
    dpi: int = 300,
) -> list[list[str]]:
    """Convert PDF page ranges to PNG files.

    Args:
        pdf_path: Path to the input PDF.
        page_ranges: List of (start_page, end_page) tuples (1-indexed, inclusive).
                     If empty, each page is returned as its own single-page chunk.
        output_dir: Directory to write PNG files into.
        dpi: Resolution for rendering (default 300).

    Returns:
        List of PNG file path lists, one sub-list per page range.

    Raises:
        FileNotFoundError: If pdf_path does not exist or cannot be opened.
        ValueError: If a page range is invalid (out of bounds or start > end).
    """
    try:
        doc = fitz.open(pdf_path)
    except RuntimeError as exc:
        raise FileNotFoundError(
            f"Cannot open PDF: {pdf_path!r}"
        ) from exc

    n_pages = doc.page_count

    effective_ranges: list[tuple[int, int]] = page_ranges or [
        (i + 1, i + 1) for i in range(n_pages)
    ]

    _validate_ranges(effective_ranges, n_pages)

    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)

    result: list[list[str]] = []
    for range_idx, (start, end) in enumerate(effective_ranges):
        chunk_paths: list[str] = []
        for page_num in range(start - 1, end):  # 0-indexed
            page = doc[page_num]
            pixmap = page.get_pixmap(matrix=matrix)
            filename = f"range{range_idx:03d}_page{page_num + 1:04d}.png"
            out_path = os.path.join(output_dir, filename)
            pixmap.save(out_path)
            chunk_paths.append(out_path)
        result.append(chunk_paths)

    doc.close()
    return result
