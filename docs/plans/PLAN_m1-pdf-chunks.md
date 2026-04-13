# PLAN: M1 — PDF → Chunks

**Feature**: PDF import pipeline — server converts PDF pages to PNGs, mobile shows thumbnail grid for range selection.
**Scope**: Large (2 parallel tracks, 5 phases total)
**Approach**: Agent team — Server Agent (S1→S2) + App Agent (A1→A2→A3) run in parallel
**Model budget**: Standard (Sonnet throughout)
**PDF library**: PyMuPDF (fitz)

---

## API Contract (locked upfront — both agents work against this)

### `POST /pdf-chunks`

**Request**
```json
{
  "pdf_b64": "<base64-encoded PDF bytes>",
  "page_ranges": [[1, 4], [5, 8]]
}
```
- `page_ranges`: 1-indexed, inclusive. Empty array `[]` = return every page as its own 1-page chunk (thumbnail mode).

**Response**
```json
{
  "chunks": [
    ["<png_b64_p1>", "<png_b64_p2>", "<png_b64_p3>", "<png_b64_p4>"],
    ["<png_b64_p5>", "<png_b64_p6>", "<png_b64_p7>", "<png_b64_p8>"]
  ]
}
```
- Each element of `chunks` corresponds to one `page_range`.
- PNGs rendered at 150 DPI (suitable for thumbnail display AND OMR input).

---

## Clean Architecture Layer Map

| File | Layer | Rule |
|------|-------|------|
| `tools/omr-server/omr_io/pdf_to_png.py` | I/O utility | No HTTP, no FastAPI |
| `tools/omr-server/main.py` | HTTP adapter | Thin wrapper only |
| `client/lib/pdfImport.ts` | Entities | No RN imports, pure TS |
| `client/hooks/usePdfImport.ts` | Use Cases | Orchestrates lib, no RN UI |
| `client/screens/PdfImportScreen.tsx` | UI | RN + hooks |
| `client/components/PageThumbnailGrid.tsx` | UI | RN + hooks |

**Dependency rule enforced at every gate:**
- `lib/` must NOT import from hooks, context, screens, components
- `hooks/` must NOT import from screens or components
- Supabase never called directly from a component or screen

---

## Phases

---

### Phase S1 — Server: Implement `omr_io/pdf_to_png.py`

**Layer**: I/O utility (no HTTP)
**Track**: Server Agent

**Files**
- `tools/omr-server/omr_io/pdf_to_png.py` — replace stub
- `tools/omr-server/tests/test_pdf_to_png.py` [TO CREATE]
- `tools/omr-server/requirements.txt` — add `pymupdf`

**Signature (unchanged from stub)**
```python
def pdf_to_png(
    pdf_path: str,
    page_ranges: list[tuple[int, int]],
    output_dir: str,
    dpi: int = 150,
) -> list[list[str]]:
    """Convert PDF page ranges to PNG files.

    Args:
        pdf_path: Absolute path to input PDF.
        page_ranges: List of (start, end) tuples, 1-indexed inclusive.
                     Empty list = all pages, each as its own 1-page range.
        output_dir: Directory to write PNGs into.
        dpi: Render resolution (default 150).

    Returns:
        List of PNG path lists, one sub-list per page range.

    Raises:
        FileNotFoundError: if pdf_path does not exist.
        ValueError: if any page number is out of bounds or start > end.
    """
```

**Test scenarios** (`test_pdf_to_png.py`)
- `test_single_range_returns_correct_page_count` — range (1,2) returns 2 PNGs
- `test_multiple_ranges_returns_correct_structure` — 2 ranges → 2 sub-lists
- `test_empty_ranges_returns_all_pages` — `[]` → one sub-list per page, N sub-lists
- `test_output_files_exist_on_disk` — returned paths actually exist
- `test_output_files_are_valid_png` — first 4 bytes = PNG magic
- `test_page_out_of_bounds_raises_value_error` — page > total → ValueError
- `test_start_after_end_raises_value_error` — (5, 2) → ValueError
- `test_missing_pdf_raises_file_not_found`
- `test_existing_stub_test_removed` — old `test_raises_not_implemented` must be replaced/removed

**Interface contract produced**: `pdf_to_png(path, ranges, dir)` is callable — imported by Phase S2.

**Quality gate**
- [ ] `pytest tests/test_pdf_to_png.py` — all tests green
- [ ] `pytest` — all 72+ tests still green (no regression)
- [ ] `ruff check .` — clean
- [ ] No function > 40 lines
- [ ] No `pdf_to_png.py` > 80 lines

---

### Phase S2 — Server: `/pdf-chunks` FastAPI endpoint

**Layer**: HTTP adapter (`main.py`)
**Track**: Server Agent (after S1)

**Files**
- `tools/omr-server/main.py` — add `PdfChunksRequest`, `PdfChunksResponse`, `POST /pdf-chunks`
- `tools/omr-server/tests/test_main_integration.py` — extend with `TestPdfChunksEndpoint`

**New Pydantic models**
```python
class PdfChunksRequest(BaseModel):
    pdf_b64: str
    page_ranges: list[tuple[int, int]] = []  # empty = all pages

class PdfChunksResponse(BaseModel):
    chunks: list[list[str]]  # list of base64 PNG strings per range
```

**Endpoint logic** (max 30 lines)
1. Decode `pdf_b64` → temp file
2. Resolve `page_ranges`: if empty, build `[(i, i) for i in range(1, n_pages+1)]`
3. Call `pdf_to_png(tmp_path, ranges, tmp_dir)`
4. For each returned PNG path, read bytes and base64-encode
5. Return `PdfChunksResponse(chunks=...)`
6. On `ValueError` → HTTP 422; on `FileNotFoundError` → HTTP 400

**Integration test scenarios** (`TestPdfChunksEndpoint`)
- `test_empty_ranges_returns_all_pages` — minimal 2-page synthetic PDF, `page_ranges=[]` → `len(chunks) == 2`, each chunk has 1 PNG b64
- `test_explicit_range_returns_correct_chunk_count` — `[[1,2]]` → 1 chunk with 2 PNGs
- `test_invalid_base64_returns_422`
- `test_page_out_of_bounds_returns_422`

**Interface contract produced**: `POST /pdf-chunks` matches the locked API contract above.

**Quality gate**
- [ ] `pytest tests/test_main_integration.py` — all tests green
- [ ] `pytest` — all tests green
- [ ] `ruff check .` — clean
- [ ] `main.py` ≤ 120 lines

---

### Phase A1 — App lib: `client/lib/pdfImport.ts`

**Layer**: Entities (pure TS, no React Native UI imports)
**Track**: App Agent

**Files**
- `client/lib/pdfImport.ts` [TO CREATE]
- `__tests__/unit/lib/pdfImport.test.ts` [TO CREATE]

**Exports**
```typescript
export type PageRange = [number, number]; // [start, end], 1-indexed inclusive

export interface PdfChunk {
  pageRange: PageRange;
  pngB64s: string[]; // one base64 PNG per page in range
}

export interface PdfChunksResult {
  chunks: PdfChunk[];
}

/** Pick a PDF from the device. Returns local URI or null if cancelled. */
export async function pickPdf(): Promise<string | null>

/** Read a local file URI and return base64 string. */
export async function readFileAsBase64(uri: string): Promise<string>

/** POST /pdf-chunks to the OMR server.
 *  pageRanges=[] returns all pages as individual chunks (thumbnail mode).
 */
export async function fetchPdfChunks(
  pdfB64: string,
  pageRanges: PageRange[],
): Promise<PdfChunksResult>
```

**Config**: OMR_API_URL reused from existing pattern in `omr.ts` — define as a module-level const.

**Test scenarios** (`pdfImport.test.ts`)
- `pickPdf returns null when user cancels` — mock `expo-document-picker` cancel
- `pickPdf returns uri when user picks file` — mock successful pick
- `readFileAsBase64 returns base64 string` — mock `expo-file-system` File
- `fetchPdfChunks calls correct endpoint with body` — mock `fetch`, assert URL + body shape
- `fetchPdfChunks maps response to PdfChunksResult` — mock response, assert structure
- `fetchPdfChunks throws on non-ok response` — mock 422, assert throws

**Interface contract produced**: `pickPdf`, `readFileAsBase64`, `fetchPdfChunks` — used by Phase A2.

**Quality gate**
- [ ] `npx jest __tests__/unit/lib/pdfImport.test.ts` — all tests green
- [ ] `tsc --noEmit` — zero type errors
- [ ] `pdfImport.ts` ≤ 100 lines
- [ ] No RN or expo-* imports in `client/lib/pdfImport.ts` except `expo-document-picker` and `expo-file-system` (these are I/O boundaries, not UI)

---

### Phase A2 — App hook: `client/hooks/usePdfImport.ts`

**Layer**: Use Cases
**Track**: App Agent (after A1)

**Files**
- `client/hooks/usePdfImport.ts` [TO CREATE]
- `__tests__/unit/hooks/usePdfImport.test.ts` [TO CREATE]

**State machine**
```
idle → picking → uploading → selecting → done
                                       ↘ error
```

**Exports**
```typescript
export type PdfImportState =
  | "idle"
  | "picking"
  | "uploading"
  | "selecting"
  | "done"
  | "error";

export interface UsePdfImportReturn {
  state: PdfImportState;
  chunks: PdfChunk[];          // all pages as individual chunks (thumbnail mode)
  pageRanges: PageRange[];     // user-defined boundaries
  error: string | null;
  startImport(): Promise<void>; // pick → upload all pages → enter selecting
  setPageRanges(ranges: PageRange[]): void;
  confirmRanges(): Promise<void>; // re-upload with explicit ranges → done
  reset(): void;
}

export function usePdfImport(): UsePdfImportReturn
```

**Test scenarios** (`usePdfImport.test.ts`)
- `initial state is idle` 
- `startImport transitions idle→picking→uploading→selecting`
- `startImport sets chunks from server response`
- `startImport transitions to error when pickPdf returns null`
- `startImport transitions to error on server failure`
- `setPageRanges updates pageRanges`
- `confirmRanges calls fetchPdfChunks with current pageRanges`
- `reset returns to idle and clears chunks`

**Interface contract produced**: `usePdfImport()` hook — consumed by Phase A3.

**Quality gate**
- [ ] `npx jest __tests__/unit/hooks/usePdfImport.test.ts` — all green
- [ ] `tsc --noEmit` — zero type errors
- [ ] No screen or component imports in `usePdfImport.ts`

---

### Phase A3 — App UI: PdfImportScreen + PageThumbnailGrid + navigation

**Layer**: Frameworks & Drivers
**Track**: App Agent (after A2)

**Files**
- `client/screens/PdfImportScreen.tsx` [TO CREATE]
- `client/components/PageThumbnailGrid.tsx` [TO CREATE]
- `client/types/navigation.ts` — add `PdfImport: { sheetId: string }`
- `client/navigation/RootStackNavigator.tsx` — wire new screen
- `__tests__/components/PageThumbnailGrid.test.tsx` [TO CREATE]

**UX flow**
1. `PdfImportScreen` mounts → shows "Import PDF" button (state: idle)
2. Tap → `startImport()` → picker opens → uploads → shows thumbnail grid (state: selecting)
3. `PageThumbnailGrid` shows all pages; user taps between pages to mark range boundaries
4. "Confirm" button → `confirmRanges()` → sends explicit ranges to server
5. On done: navigate to existing `PracticeDetail` or back to Library with a success toast

**`PageThumbnailGrid` props**
```typescript
interface PageThumbnailGridProps {
  chunks: PdfChunk[];          // one chunk per page (thumbnail mode)
  pageRanges: PageRange[];
  onPageRangesChange(ranges: PageRange[]): void;
}
```

**Test scenarios** (`PageThumbnailGrid.test.tsx`)
- `renders one thumbnail per chunk`
- `tapping between pages toggles a boundary marker`
- `onPageRangesChange called with correct ranges after boundary tap`
- `no boundaries selected → one range covering all pages`

**Quality gate**
- [ ] `npx jest __tests__/components/PageThumbnailGrid.test.tsx` — all green
- [ ] `npx jest` — full suite green
- [ ] `tsc --noEmit` — zero type errors
- [ ] `npx expo lint` — zero errors
- [ ] `PdfImportScreen.tsx` ≤ 200 lines
- [ ] `PageThumbnailGrid.tsx` ≤ 150 lines
- [ ] No screen imports another screen

---

## Agent Team Configuration

| Agent | Role | Phases | Start condition |
|-------|------|--------|----------------|
| `server-agent` | Server implementer | S1 → S2 | Immediately |
| `app-agent` | App implementer | A1 → A2 → A3 | Immediately (works against locked API contract) |

Main thread runs all quality gates. Agents do not cross tracks.

Communication protocol (SendMessage):
```
PHASE: <S1|S2|A1|A2|A3>
STATUS: READY | DONE | BLOCKED | FAILED
NEXT: <what the receiving agent should do>
FILES: <comma-separated files touched>
NOTES: <errors, context>
```

---

## Commands

| Command | Use |
|---------|-----|
| `cd tools/omr-server && pytest` | Server tests |
| `cd tools/omr-server && ruff check .` | Server lint |
| `npx jest` | App tests |
| `tsc --noEmit` | App types |
| `npx expo lint` | App lint |

---

## Progress Tracker

### Server Track
- [ ] S1: `omr_io/pdf_to_png.py` implemented + `test_pdf_to_png.py` passing
- [ ] S1: `requirements.txt` has `pymupdf`
- [ ] S1: Quality gate passed (pytest + ruff)
- [ ] S2: `/pdf-chunks` endpoint in `main.py`
- [ ] S2: `TestPdfChunksEndpoint` tests passing
- [ ] S2: Quality gate passed (pytest + ruff, main.py ≤ 120 lines)

### App Track
- [ ] A1: `client/lib/pdfImport.ts` + `pdfImport.test.ts` passing
- [ ] A1: Quality gate passed (jest + tsc)
- [ ] A2: `client/hooks/usePdfImport.ts` + `usePdfImport.test.ts` passing
- [ ] A2: Quality gate passed (jest + tsc)
- [ ] A3: `PdfImportScreen.tsx` + `PageThumbnailGrid.tsx` + navigation wired
- [ ] A3: Quality gate passed (jest + tsc + expo lint)

### Final
- [ ] Global maintainability audit clean
- [ ] All tests green across both tracks
- [ ] No unchecked boxes above
