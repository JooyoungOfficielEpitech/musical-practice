"""OMR Server — FastAPI entry point.

Thin wrapper: decodes the incoming image, delegates to core/ and pipeline/,
returns the best MusicXML result.
"""

import base64
import logging
import tempfile
import os
import threading

from dotenv import load_dotenv
load_dotenv()

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.staff_cropper import crop_vocal_staff
from pipeline.omr_runner import run_best_strategy
from omr_io.pdf_to_png import pdf_to_png

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("omr")

app = FastAPI(title="OMR Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class OmrRequest(BaseModel):
    image: str  # base64-encoded PNG/JPG


class OmrResponse(BaseModel):
    musicxml: str = ""
    success: bool = True
    error: str = ""
    attempts: int = 0
    best_score: float = 0.0
    strategy: str = ""

class PdfChunksRequest(BaseModel):
    pdf_b64: str
    page_ranges: list[tuple[int, int]] = []


class PdfChunksResponse(BaseModel):
    chunks: list[list[str]]  # base64 PNG strings per range


@app.post("/pdf-chunks", response_model=PdfChunksResponse)
def run_pdf_chunks(req: PdfChunksRequest):
    try:
        pdf_bytes = base64.b64decode(req.pdf_b64)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid base64 PDF data")

    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        try:
            png_paths = pdf_to_png(pdf_path, req.page_ranges, tmp_dir)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        chunks: list[list[str]] = []
        for path_list in png_paths:
            encoded = []
            for path in path_list:
                with open(path, "rb") as f:
                    encoded.append(base64.b64encode(f.read()).decode())
            chunks.append(encoded)

    return PdfChunksResponse(chunks=chunks)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/omr", response_model=OmrResponse)
def run_omr(req: OmrRequest):
    try:
        image_data = base64.b64decode(req.image)
    except Exception:
        return OmrResponse(success=False, error="Invalid base64 image data")

    nparr = np.frombuffer(image_data, np.uint8)
    raw_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if raw_image is None:
        return OmrResponse(success=False, error="Could not decode image")

    log.info(f"=== OMR request === image shape={raw_image.shape}")

    try:
        cropped = crop_vocal_staff(raw_image)
        if cropped is not None:
            log.info(f"Staff cropper: {raw_image.shape} -> {cropped.shape}")
            raw_image = cropped
        else:
            log.warning("Staff cropper returned None, using raw image")
    except Exception as e:
        log.warning(f"Staff cropper failed, using raw image: {e}")

    try:
        best_xml, best_score, best_strategy = run_best_strategy(raw_image)
        return OmrResponse(
            musicxml=best_xml,
            success=True,
            best_score=best_score,
            strategy=best_strategy,
        )
    except RuntimeError as e:
        return OmrResponse(success=False, error=str(e))

def _start_poller():
    try:
        from omr_queue.poller import run_poll_loop
        log.info("OMR queue poller started")
        run_poll_loop()
    except Exception as e:
        log.error("OMR queue poller failed to start: %s", e)


@app.on_event("startup")
def startup_event():
    from pipeline.homr_pool import start_pool
    start_pool()  # keep homr models warm across jobs
    t = threading.Thread(target=_start_poller, daemon=True)
    t.start()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
