"""Korean-capable page OCR via Apple's Vision framework (macOS only).

Audiveris' Tesseract cannot read Korean lyrics (verified: 128 notes, ~0
lyrics on the reference score), so lyric extraction OCRs the page with
Vision instead. Vision returns text-line observations; we split each line
into per-syllable tokens (hangul syllables are one note-syllable each) and
recover a bounding box per token via VNRecognizedText.boundingBoxForRange.

Strictly additive: when pyobjc/Vision is unavailable or anything fails,
callers receive [] and the pipeline proceeds without lyrics.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

log = logging.getLogger("omr.vision_ocr")

_HANGUL_START = 0xAC00
_HANGUL_END = 0xD7A3


@dataclass(frozen=True)
class OcrToken:
    """One lyric token (a hangul syllable or a latin word) in page pixels."""

    text: str
    cx: float
    cy: float
    x0: float
    y0: float
    x1: float
    y1: float


def _is_hangul(ch: str) -> bool:
    return _HANGUL_START <= ord(ch) <= _HANGUL_END


def vision_available() -> bool:
    try:
        import Vision  # noqa: F401
        import Quartz  # noqa: F401
        return True
    except ImportError:
        return False


def _token_ranges(text: str) -> list[tuple[int, int, str]]:
    """Split a line into (start, length, token) units.

    Hangul syllables become single-character tokens (one syllable per note in
    Korean vocal engraving); consecutive non-hangul, non-space characters are
    grouped into one token (latin words, punctuation runs like "Oh," or "1.").
    """
    ranges: list[tuple[int, int, str]] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch.isspace():
            i += 1
            continue
        if _is_hangul(ch):
            ranges.append((i, 1, ch))
            i += 1
            continue
        j = i
        while j < n and not text[j].isspace() and not _is_hangul(text[j]):
            j += 1
        ranges.append((i, j - i, text[i:j]))
        i = j
    return ranges


def ocr_page_tokens(png_path: str) -> list[OcrToken]:
    """OCR one page image into per-syllable tokens with page-pixel boxes.

    Returns [] on any failure (missing frameworks, unreadable image, no text).
    """
    if not vision_available():
        return []
    try:
        return _ocr_page_tokens_impl(png_path)
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("Vision OCR failed for %s: %s", png_path, exc)
        return []


def _ocr_page_tokens_impl(png_path: str) -> list[OcrToken]:
    import Quartz
    import Vision
    from Foundation import NSURL, NSRange

    url = NSURL.fileURLWithPath_(png_path)
    src = Quartz.CGImageSourceCreateWithURL(url, None)
    if src is None:
        log.warning("Vision OCR: cannot open %s", png_path)
        return []
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
    if cg_image is None:
        return []
    width = Quartz.CGImageGetWidth(cg_image)
    height = Quartz.CGImageGetHeight(cg_image)

    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setRecognitionLanguages_(["ko-KR", "en-US"])
    request.setUsesLanguageCorrection_(False)  # lyrics are not prose

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        log.warning("Vision OCR request failed: %s", err)
        return []

    tokens: list[OcrToken] = []
    for observation in request.results() or []:
        candidates = observation.topCandidates_(1)
        if not candidates or candidates.count() == 0:
            continue
        candidate = candidates.objectAtIndex_(0)
        text = str(candidate.string())
        for start, length, tok in _token_ranges(text):
            box_obs, box_err = candidate.boundingBoxForRange_error_(
                NSRange(start, length), None
            )
            if box_obs is None:
                continue
            bb = box_obs.boundingBox()
            # Vision boxes are normalized with a bottom-left origin — flip y.
            x0 = bb.origin.x * width
            x1 = (bb.origin.x + bb.size.width) * width
            y1 = (1.0 - bb.origin.y) * height
            y0 = (1.0 - bb.origin.y - bb.size.height) * height
            tokens.append(
                OcrToken(
                    text=tok,
                    cx=(x0 + x1) / 2.0,
                    cy=(y0 + y1) / 2.0,
                    x0=x0, y0=y0, x1=x1, y1=y1,
                )
            )
    log.info("Vision OCR: %d tokens on %s", len(tokens), png_path.split("/")[-1])
    return tokens
