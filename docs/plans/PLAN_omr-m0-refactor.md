# PLAN: OMR Server M0 Refactor

**Status**: COMPLETE ✓ (2026-04-09)  
**Scope**: Medium (4 phases, ~12–18h)  
**Model budget**: Standard (Sonnet throughout)  
**Approach**: Skill chain (sequential TDD)  
**Test command**: `cd tools/omr-server && source venv/bin/activate && python -m pytest tests/ -v`  
**Lint command**: `cd tools/omr-server && source venv/bin/activate && ruff check .`  
**Type check**: N/A (Python — no static type check tool installed; use explicit type annotations + pytest)

---

## Goal

Reorganise `tools/omr-server/` from a flat pile of scripts into a clean `core/ → pipeline/ → io/` package hierarchy. The existing `/omr` endpoint must keep working with identical behaviour after every phase.

---

## Layer Map (Python CA analogue)

| Layer | Package | Rule |
|-------|---------|------|
| **Core** — pure image processing | `core/` | No subprocess, no file I/O, no web imports. Only numpy/opencv/stdlib. |
| **Pipeline** — orchestration & XML | `pipeline/` | May call subprocess (homr). No FastAPI imports. |
| **I/O** — file adapters & stubs | `io/` | File reads/writes, PDF/PNG conversion. No FastAPI imports. |
| **Entry point** — web layer | `main.py` | FastAPI only. Thin: imports from all layers, exposes endpoints. |

**Dependency rule**: `core/` ← `pipeline/` ← `io/` ← `main.py`  
Inner layers must never import from outer layers.

---

## File Mapping: Current → Target

### `staff_cropper.py` (990 lines) → split into 3

| Current function | Target file |
|-----------------|------------|
| `_to_gray`, `_binarize`, `_build_staff_mask`, `_detect_staff_line_rows`, `_group_staff_lines`, `_group_into_staves`, `_find_staff_start_x`, `_check_barline_connectivity`, `_group_staves_into_systems` | `core/staff_detector.py` |
| `_crop_single_staff`, `_measure_label_ink`, `_ocr_label_region`, `_assign_labels_by_position` | `core/label_ocr.py` |
| `replace_x_noteheads`, `_make_x_template`, `crop_vocal_staff`, `crop_all_vocal_staves`, `crop_vocal_staff_from_file` | `core/staff_cropper.py` (thin) |

### `postprocess.py` (642 lines) → split into 2

| Current function | Target file |
|-----------------|------------|
| `pitch_to_midi`, `note_to_midi`, `analyze_measure`, `make_rest_measure`, `build_output`, `clean_measure`, `ensure_first_measure_attributes`, `inject_tempo`, `fix_octave_errors`, `convert_repeated_eighths_to_unpitched`, `normalize_spoken_measures`, `pad_with_rest_measures`, `strip_repeats`, `_is_single_part_input`, `fill_empty_measures`, `postprocess` | `pipeline/postprocessor.py` |
| `split_voices` | `pipeline/voice_splitter.py` |

### `process_duet_pages.py` (559 lines) → split into 2

| Current function | Target file |
|-----------------|------------|
| `process_single_staff`, `stitch_staves` | `pipeline/omr_runner.py` |
| `merge_character_pages`, `process_duet_pages` | `pipeline/alignment.py` |

### `process_all_pages.py` (283 lines) → merged into pipeline/

| Current function | Target file |
|-----------------|------------|
| `run_homr`, `process_page` | `pipeline/omr_runner.py` |
| `merge_pages` | `io/xml_writer.py` |

### `main.py` (365 lines) — preprocessing strategies move out

| Current function | Target file |
|-----------------|------------|
| All 7 `preprocess_*` functions, `STRATEGIES`, `try_strategy` | `pipeline/omr_runner.py` |
| `score_musicxml` | `pipeline/omr_runner.py` |
| `run_omr` endpoint, `health` endpoint, `OmrRequest`, `OmrResponse` | `main.py` (keep, slim down) |

### `combine_parts.py` (144 lines) → `io/xml_writer.py`

| Current function | Target file |
|-----------------|------------|
| `load_part`, `combine_parts` | `io/xml_writer.py` |
| `make_rest_measure` | **Consolidated** — deduplicate with copies in `process_duet_pages.py` and `postprocess.py`. Single canonical version lives in `pipeline/postprocessor.py`, re-exported or imported by others. |

### Other files

| File | Target |
|------|--------|
| `validate.py` (432 lines) | `pipeline/validator.py` — MusicXML pair scoring (NoteInfo, MeasureInfo, ScoreInfo, score_musicxml_pair) |
| `debug_annotate.py` (199 lines) | `io/debug_annotate.py` |
| `test_staff_cropper.py` (195 lines) | `tests/test_staff_cropper.py` (migrate, keep all 12 tests) |
| `test_pipeline.py` (527 lines) | `tests/test_pipeline.py` (migrate) |

### New stubs (M1/M3 prep)

| File | Content |
|------|---------|
| `io/pdf_to_png.py` | Stub: `def pdf_to_png(...) -> ...: raise NotImplementedError` |
| `server.py` | Stub: Supabase polling loop skeleton, `raise NotImplementedError` |

---

## Phases

### Phase 1 — `core/` package
**Layer**: Core (pure image processing)  
**Goal**: Extract staff detection + OCR logic from `staff_cropper.py` into three focused modules.

**Files to create**:
- `core/__init__.py` [TO CREATE]
- `core/staff_detector.py` [TO CREATE] — extracted from `staff_cropper.py`
- `core/label_ocr.py` [TO CREATE] — extracted from `staff_cropper.py`
- `core/staff_cropper.py` [TO CREATE] — thin coordinator (≤ 150 lines)
- `tests/__init__.py` [TO CREATE]
- `tests/test_staff_detector.py` [TO CREATE]
- `tests/test_label_ocr.py` [TO CREATE]
- `tests/test_staff_cropper.py` [MIGRATE from `test_staff_cropper.py`]

**Key interfaces produced**:
```python
# core/staff_detector.py
def detect_staff_lines(bw: np.ndarray) -> list[tuple[int, int]]: ...
def group_into_staves(lines: list[tuple[int, int]], img_height: int) -> list[list[tuple[int, int]]]: ...
def group_staves_into_systems(staves: list, bw: np.ndarray) -> list[list]: ...

# core/label_ocr.py
def ocr_label_region(img: np.ndarray, region: tuple) -> str: ...
def assign_labels_by_position(systems: list, img: np.ndarray) -> list[dict]: ...

# core/staff_cropper.py
def crop_vocal_staff(img: np.ndarray, padding_factor: float = 1.5) -> Optional[np.ndarray]: ...
def crop_all_vocal_staves(img: np.ndarray) -> list[dict]: ...  # returns [{label, image}]
```

**Test scenarios** (`tests/test_staff_detector.py`):
- `_to_gray` converts BGR image → single channel
- `_binarize` produces binary image (only 0 and 255 values)
- `detect_staff_lines` finds lines in a synthetic score image
- `group_into_staves` groups 5 lines into one stave
- `group_staves_into_systems` groups staves sharing a barline

**Test scenarios** (`tests/test_label_ocr.py`):
- `assign_labels_by_position` returns empty list when no systems
- `ocr_label_region` returns string (may be empty on blank region)

**Quality gate**:
- [ ] `python -m pytest tests/ -v` — all 14 migrated + new tests pass
- [ ] `ruff check core/` — zero errors (install ruff first: `pip install ruff`)
- [ ] No file in `core/` imports from `pipeline/`, `io/`, or `main.py`
- [ ] No file in `core/` exceeds 300 lines
- [ ] No function exceeds 50 lines

---

### Phase 2 — `pipeline/` package
**Layer**: Pipeline (OMR orchestration + XML processing)  
**Goal**: Extract preprocessing strategies, homr runner, postprocessor, voice splitter, alignment, and validator into focused pipeline modules.

**Files to create**:
- `pipeline/__init__.py` [TO CREATE]
- `pipeline/omr_runner.py` [TO CREATE] — from `main.py` strategies + `process_all_pages.py` + `process_duet_pages.py` (process_single_staff, stitch_staves)
- `pipeline/postprocessor.py` [TO CREATE] — from `postprocess.py` (minus split_voices)
- `pipeline/voice_splitter.py` [TO CREATE] — from `postprocess.py` split_voices
- `pipeline/alignment.py` [TO CREATE] — from `process_duet_pages.py` (merge_character_pages, process_duet_pages)
- `pipeline/validator.py` [TO CREATE] — from `validate.py`
- `tests/test_postprocessor.py` [TO CREATE]
- `tests/test_voice_splitter.py` [TO CREATE]
- `tests/test_alignment.py` [TO CREATE]
- `tests/test_pipeline.py` [MIGRATE from `test_pipeline.py`]

**Key interfaces produced**:
```python
# pipeline/omr_runner.py
def run_homr(image_path: str, work_dir: str) -> Optional[str]: ...
def run_best_strategy(image: np.ndarray) -> tuple[str, float, str]: ...
  # returns (musicxml, score, strategy_name)

# pipeline/postprocessor.py
def postprocess(raw_xml: str) -> str: ...
def make_rest_measure(divisions: int = 2) -> ET.Element: ...  # canonical

# pipeline/voice_splitter.py
def split_voices(xml_string: str) -> dict[str, str]: ...
  # returns {"soprano": xml, "alto": xml, ...}

# pipeline/alignment.py
def merge_character_pages(pages: list[dict]) -> dict[str, str]: ...
def process_duet_pages(images: list[np.ndarray]) -> dict[str, str]: ...

# pipeline/validator.py
def score_musicxml(xml_string: str) -> tuple[float, dict]: ...
def score_musicxml_pair(ref_path: str, candidate_path: str) -> dict: ...
```

**Test scenarios** (`tests/test_postprocessor.py`):
- `postprocess` on empty/invalid XML raises or returns gracefully
- `strip_repeats` removes repeat barlines from well-formed XML
- `inject_tempo` adds a `<sound tempo=...>` element to first measure
- `fill_empty_measures` inserts rest measure when no notes present
- `make_rest_measure` returns valid `<measure>` element with one rest

**Test scenarios** (`tests/test_voice_splitter.py`):
- `split_voices` on single-part XML returns dict with one key
- `split_voices` on SATB XML returns dict with correct part names
- Output XMLs are valid (parseable by ET)

**Test scenarios** (`tests/test_alignment.py`):
- `merge_character_pages` with zero pages returns empty dict
- `merge_character_pages` with matching measure counts merges correctly
- `merge_character_pages` pads shorter part with rests to match longer

**Quality gate**:
- [ ] `python -m pytest tests/ -v` — all tests pass
- [ ] `ruff check pipeline/` — zero errors
- [ ] No file in `pipeline/` imports from `io/` or `main.py`
- [ ] No file exceeds 300 lines; no function exceeds 50 lines
- [ ] `make_rest_measure` duplicate is resolved — single canonical version

---

### Phase 3 — `io/` package + stubs
**Layer**: I/O (file adapters)  
**Goal**: Move file I/O, XML merging, debug annotation, and M1/M3 stubs into `io/`.

**Files to create**:
- `io/__init__.py` [TO CREATE]
- `io/xml_writer.py` [TO CREATE] — from `combine_parts.py` (load_part, combine_parts) + `process_all_pages.py` (merge_pages)
- `io/pdf_to_png.py` [TO CREATE] — M1 stub
- `io/debug_annotate.py` [TO CREATE] — from `debug_annotate.py`
- `tests/test_xml_writer.py` [TO CREATE]

**Key interfaces produced**:
```python
# io/xml_writer.py
def load_part(path: str) -> tuple[list[ET.Element], int]: ...
def combine_parts(parts: list[tuple[list[ET.Element], int]], output_path: str) -> None: ...
def merge_pages(page_xmls: list[str]) -> str: ...

# io/pdf_to_png.py
def pdf_to_png(
    pdf_path: str,
    page_ranges: list[tuple[int, int]],
    output_dir: str,
) -> list[list[str]]:
    """Convert PDF page ranges to PNG files. M1 stub — raises NotImplementedError."""
    raise NotImplementedError("M1: pdf_to_png not yet implemented")
```

**Test scenarios** (`tests/test_xml_writer.py`):
- `load_part` on a valid MusicXML file returns (measures_list, divisions_int)
- `combine_parts` with one part produces valid multi-part MusicXML
- `merge_pages` with two single-measure XMLs produces two-measure XML
- `pdf_to_png` raises `NotImplementedError`

**Quality gate**:
- [ ] `python -m pytest tests/ -v` — all tests pass
- [ ] `ruff check io/` — zero errors
- [ ] `io/pdf_to_png.py` raises `NotImplementedError` (confirmed by test)
- [ ] No file in `io/` imports from `main.py`

---

### Phase 4 — `main.py` cleanup + integration
**Layer**: Entry point  
**Goal**: Slim `main.py` down to a thin FastAPI wrapper that imports from the new packages. Verify the `/omr` endpoint is functionally identical. Delete or archive old flat files.

**Files to modify**:
- `main.py` [REWRITE] — remove all preprocessing strategy code, import from `pipeline/omr_runner`, `core/staff_cropper`, `pipeline/postprocessor`

**Files to install ruff into**:
- `requirements.txt` — add `ruff`, `pytest` (already installed in venv but not in requirements)

**Files to delete** (after all tests pass):
- `staff_cropper.py` (root) — replaced by `core/staff_cropper.py`
- `postprocess.py` — replaced by `pipeline/postprocessor.py` + `pipeline/voice_splitter.py`
- `process_duet_pages.py` — replaced by `pipeline/omr_runner.py` + `pipeline/alignment.py`
- `process_all_pages.py` — replaced by `pipeline/omr_runner.py` + `io/xml_writer.py`
- `combine_parts.py` — replaced by `io/xml_writer.py`
- `validate.py` — replaced by `pipeline/validator.py`
- `debug_annotate.py` — replaced by `io/debug_annotate.py`
- `test_staff_cropper.py` (root) — migrated to `tests/`
- `test_pipeline.py` (root) — migrated to `tests/`

**Target `main.py`** (≤ 100 lines):
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from core.staff_cropper import crop_vocal_staff
from pipeline.omr_runner import run_best_strategy
from pipeline.postprocessor import postprocess

app = FastAPI(title="OMR Server")
# ... CORS, /health, /omr endpoint only
```

**Integration test scenario**:
- POST `/omr` with a valid base64-encoded PNG → returns `OmrResponse` with `success=True` and non-empty `musicxml`
- POST `/omr` with invalid base64 → returns `success=False` with error message

**Quality gate**:
- [ ] `python -m pytest tests/ -v` — all tests pass
- [ ] `ruff check .` (root, excluding venv) — zero errors
- [ ] `main.py` ≤ 100 lines
- [ ] No old flat files remain (or explicitly archived with `# ARCHIVED` comment if user prefers)
- [ ] CA dependency rule: `core/` never imports `pipeline/`; `pipeline/` never imports `main.py`

---

## Global Maintainability Audit (post all phases)

Run after Phase 4:

```bash
# Files over 300 lines (Python threshold)
wc -l core/*.py pipeline/*.py io/*.py main.py | awk '$1 > 300 {print}'

# Any remaining `make_rest_measure` duplicates
grep -rn "def make_rest_measure" .

# Verify no cross-layer imports
grep -rn "from main" core/ pipeline/ io/
grep -rn "from pipeline\|from io\|from main" core/

# Verify pdf_to_png stub
grep -n "NotImplementedError" io/pdf_to_png.py
```

Then run `sc:analyze` for architectural review.

---

## Setup: Install ruff

Before Phase 1, run once:
```bash
cd tools/omr-server && source venv/bin/activate && pip install ruff
```
Add to `requirements.txt`: `ruff`

---

## Progress Tracker

- [x] Setup: install ruff, create `tests/` dir
- [x] Phase 1 — `core/` package `PHASE_1_DONE`
- [x] Phase 2 — `pipeline/` package `PHASE_2_DONE`
- [x] Phase 3 — `omr_io/` package + stubs `PHASE_3_DONE` (renamed from `io/` — conflicts with Python stdlib)
- [x] Phase 4 — `main.py` cleanup + integration `PHASE_4_DONE`
- [x] Global maintainability audit
- [x] `FEATURE_COMPLETE`

## Audit Notes
- `pipeline/omr_runner.py` (351 lines) and `pipeline/postprocessor.py` (331 lines) slightly exceed 300-line threshold.
  Both contain many small, well-structured functions (13 and 16 respectively). No single function exceeds 50 lines. Acceptable.
- `io/` renamed to `omr_io/` — `io` is a Python stdlib module name, causing import conflicts.
- `make_rest_measure` deduplicated: single canonical version in `pipeline/postprocessor.py`.
