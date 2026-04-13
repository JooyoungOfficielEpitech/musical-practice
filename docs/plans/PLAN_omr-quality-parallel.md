# PLAN: OMR Server — Quality + Parallelism Upgrade

## Overview

Two-phase upgrade to the Python OMR server:
1. **Image quality**: 300 DPI rendering + `enhance_for_omr` preprocessing (unsharp mask + denoising)
2. **Parallelism**: page-level + character-level `ThreadPoolExecutor` in both job pipelines; worker cap in `run_best_strategy`

**Approach**: Agent team — Phase 1 and Phase 2 touch disjoint files and can run in parallel.  
**Token budget**: Standard (Sonnet)  
**Test command**: `./venv/bin/pytest tests/ -q` (run from `tools/omr-server/`)  
**Lint command**: `./venv/bin/ruff check .`

---

## Phase 1 — Image Quality

**Files touched**:
- `omr_io/pdf_to_png.py` (existing)
- `core/staff_cropper.py` (existing)
- `tests/test_pdf_to_png.py` (existing — add DPI test)
- `tests/test_staff_cropper.py` (existing — add enhance_for_omr tests)

### Changes

#### `pdf_to_png.py`
- Change `dpi: int = 150` → `dpi: int = 300`
- No other changes — all existing tests still pass at new default

#### `core/staff_cropper.py` — add `enhance_for_omr(img: np.ndarray) -> np.ndarray`
```
1. Convert to grayscale if BGR
2. fastNlMeansDenoising(h=5)   — mild, preserves fine note details
3. GaussianBlur(σ=2.0) → addWeighted(1.5 original, -0.5 blur)  — unsharp mask
4. Return sharpened grayscale array
```
- Called in `job_processor._run_simple_pipeline` and `_run_vocal_score_pipeline` after `cv2.imread`, before staff detection

### Test scenarios (RED before GREEN)

**`test_pdf_to_png.py` additions**:
- `test_default_dpi_renders_at_300` — render a 1-page PDF, measure output PNG pixel dimensions; at 300 DPI a 595pt-wide page → ~2479 px wide (595 × 300/72)
- `test_explicit_dpi_150_still_works` — explicitly passing dpi=150 still produces smaller output

**`test_staff_cropper.py` additions**:
- `test_enhance_for_omr_returns_grayscale_ndarray` — BGR input → 2D uint8 output
- `test_enhance_for_omr_grayscale_input_unchanged_dims` — grayscale in → same shape out
- `test_enhance_for_omr_sharpens_edges` — apply to a soft-blurred image, check Laplacian variance increases vs input (sharpness metric)
- `test_enhance_for_omr_preserves_dark_pixels` — dark text pixels on white background remain dark (< 100 threshold after enhance)

### Interface contract → Phase 2
Phase 2's `job_processor` will call `enhance_for_omr` from `core.staff_cropper`. The function must exist and accept an `np.ndarray`.

### Quality gate
- [ ] `./venv/bin/pytest tests/test_pdf_to_png.py tests/test_staff_cropper.py -q` — all green
- [ ] `./venv/bin/pytest tests/ -q` — full suite green (95 + new tests)
- [ ] `./venv/bin/ruff check omr_io/pdf_to_png.py core/staff_cropper.py`
- [ ] `enhance_for_omr` ≤ 25 lines; `pdf_to_png.py` unchanged in structure
- [ ] No file exceeds 250 lines

---

## Phase 2 — Parallelism

**Files touched**:
- `omr_queue/job_processor.py` (existing)
- `pipeline/omr_runner.py` (existing)
- `tests/test_job_processor.py` (existing — extend)

### Changes

#### `pipeline/omr_runner.py` — worker cap in `run_best_strategy`
```python
# Phase 2 pool (strategies[3:]) — was hardcoded max_workers=3
max_workers = max(1, min(len(STRATEGIES[3:]), (os.cpu_count() or 4) // 2))
```
Prevents over-subscription when multiple pages are being processed in parallel.

#### `omr_queue/job_processor.py` — page-level parallelism

Extract page-processing logic into helper functions, then wrap with `ThreadPoolExecutor`:

**`_run_simple_pipeline`**:
```
all_pages = [path for chunk in chunks for path in chunk]
max_workers = min(len(all_pages), os.cpu_count() or 4)
with ThreadPoolExecutor(max_workers) as ex:
    futures = {ex.submit(_process_simple_page, path, tmp_dir): path for path in all_pages}
    for future in as_completed(futures):
        measures = future.result()  # list[ET.Element] or []
        if measures:
            page_measure_lists.append(measures)
```

**`_run_vocal_score_pipeline`**:
- Page-level: each page → `_process_vocal_page(png_path, tmp_dir)` returns `(char_sys_dict, sys_indices)`
- Character-level within page: inside `_process_vocal_page`, each character's staves processed with `ThreadPoolExecutor(max_workers=min(len(chars), 4))`
- Result merging is sequential (order preserved via dict keyed by global_sys_offset + local_sys_idx)

**New private helpers**:
- `_process_simple_page(png_path, tmp_dir) -> list[ET.Element]`
- `_process_vocal_page(png_path, tmp_dir, global_sys_offset) -> tuple[dict, list[int]]`

### Test scenarios (RED before GREEN)

**`test_job_processor.py` additions**:
- `test_simple_pipeline_processes_pages_in_parallel` — mock `_process_simple_page`, verify it's called for all pages; use `threading.current_thread()` side-effect to confirm concurrent execution
- `test_vocal_pipeline_calls_process_single_staff_per_char` — mock `process_single_staff` + `crop_all_vocal_staves` returning 2 chars; verify `process_single_staff` called for both
- `test_worker_cap_does_not_exceed_cpu_count` — patch `os.cpu_count` → 2; run simple pipeline with 10 pages; verify `ThreadPoolExecutor` was constructed with `max_workers ≤ 2`
- `test_page_failure_does_not_abort_pipeline` — one page's `_process_simple_page` raises RuntimeError; other pages still produce output; no OmrQueueError

### Interface contract
Both pipelines remain callable with the same signature. `process_job` return type unchanged (`str`).

### Quality gate
- [ ] `./venv/bin/pytest tests/test_job_processor.py -q` — all green
- [ ] `./venv/bin/pytest tests/ -q` — full suite green
- [ ] `./venv/bin/ruff check omr_queue/job_processor.py pipeline/omr_runner.py`
- [ ] No new file > 250 lines; no function > 40 lines
- [ ] `_run_vocal_score_pipeline` and `_run_simple_pipeline` each < 40 lines after helper extraction

---

## Agent Team Configuration

```
Phase 1 Agent (image-quality)          Phase 2 Agent (parallelism)
  sc:test → sc:implement                  sc:test → sc:implement
  Files: pdf_to_png, staff_cropper        Files: job_processor, omr_runner
  ← run in parallel →
```

Main thread merges both after quality gates pass, then runs global audit.

---

## Global Maintainability Audit (after both phases)

```bash
wc -l omr_io/pdf_to_png.py core/staff_cropper.py omr_queue/job_processor.py pipeline/omr_runner.py
./venv/bin/ruff check .
./venv/bin/pytest tests/ -q
```

- [ ] All files ≤ 250 lines
- [ ] Full test suite green
- [ ] Ruff clean

---

## Status

- [x] PHASE_1_DONE
- [x] PHASE_2_DONE
- [x] FEATURE_COMPLETE

## Post-Audit: Tech Debt

Two files exceed 250 lines — both were over the limit **before** this feature:
- `core/staff_cropper.py`: 309 lines (was ~294 before `enhance_for_omr`). Candidate for splitting: `replace_x_noteheads` + `enhance_for_omr` into `core/image_enhancer.py`, staff crop logic stays in `staff_cropper.py`.
- `pipeline/omr_runner.py`: 355 lines (was 351 before dynamic worker cap). Candidate for splitting: preprocessing strategy functions into `pipeline/strategies.py`.

Decision: log as tech debt, address in a dedicated refactor pass.
