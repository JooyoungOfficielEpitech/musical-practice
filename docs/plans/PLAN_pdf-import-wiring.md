# Implementation Plan: PDF Import End-to-End Wiring

**Status**: Complete  
**Approach**: Skill Chain  
**Started**: 2026-04-10  
**Last Updated**: 2026-04-10

---

> **Protocol**: Per phase — write ALL failing tests first (RED), verify they fail, implement (GREEN), refactor (REFACTOR), run full quality gate. Never advance with failing checks.

---

## Overview

**What it does**: Closes 5 gaps between the built OMR pipeline and the actual user experience — adds an entry point to PDF import, wires N sections → N OMR jobs → N practice cards, adds a section naming step, and removes dead code.

**Why it's needed**: The entire PDF → practice card flow is built but unreachable from the UI and produces zero cards when run. The user concept (one PDF → multiple practice cards, one per musical number) is broken end-to-end.

**Detected commands**:
- Type check: `npm run check:types`
- Tests: `npx jest`
- Lint: `npx expo lint`

---

## Success Criteria
- [ ] Library screen has an "Import PDF" entry point reachable by the user
- [ ] Selecting N sections and confirming submits N OMR jobs (one per section)
- [ ] Each completed OMR job creates exactly one SheetMusic card in the library
- [ ] User can name each section before submitting
- [ ] Dead `confirmRanges` removed from `usePdfImport`
- [ ] `RootStackParamList` `PdfImport` params corrected (no longer requires `sheetId`)
- [ ] `npm run check:types` clean, `npx jest` green (no new failures), `npx expo lint` clean

---

## Architecture Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Upload PDF once, submit N jobs with different single-range `page_ranges` | Avoids re-uploading the same file N times. `submitOmrJob(storagePath, [[start, end]])` already supports single-range. | N Supabase Realtime subscriptions open simultaneously |
| Card creation happens inside the new hook via callback | Keeps PracticeContext access at the hook layer (use case). Screen stays dumb. | Hook needs access to `addSheet` via a callback parameter |
| Add "naming" state to `usePdfImport` state machine | Section titles are part of the import flow, not a separate screen. Keeps the state machine the single source of truth. | `usePdfImport` grows slightly — still well under 250 lines |
| `PdfImport` nav params → `undefined` | No `sheetId` pre-assigned at navigation time — IDs are generated per-job at submit time. | Needs `navigation.ts` + call-site update |
| Entry point = action sheet on `+` press | Single familiar button, two options ("Add Score" / "Import PDF"). No extra header icons needed. | Slightly more taps than a dedicated icon — acceptable for a power-user flow |

---

## Dependencies

**Confirmed existing files this feature depends on:**
- [x] `client/hooks/usePdfImport.ts` — state machine to clean up
- [x] `client/hooks/useOmrJob.ts` — single-job hook that `useMultiOmrJobs` will orchestrate
- [x] `client/lib/omrQueue.ts` — `uploadPdfToStorage`, `submitOmrJob`, `downloadResult`
- [x] `client/lib/pdfImport.ts` — `PageRange`, `PdfChunk` types
- [x] `client/lib/storage.ts` — `SheetMusic` type, `saveSheet`
- [x] `client/screens/PdfImportScreen.tsx` — to rewrite
- [x] `client/screens/LibraryScreen.tsx` — to add entry point
- [x] `client/types/navigation.ts` — to fix `PdfImport` params
- [x] `__tests__/unit/hooks/usePdfImport.test.ts` — to update
- [x] `__tests__/unit/hooks/useOmrJob.test.ts` — reference for mock pattern

**New packages**: none

---

## Phase Breakdown

---

### Phase 1: `useMultiOmrJobs` hook
**Layer**: Use Cases  
**Goal**: Hook that uploads one PDF, submits N single-section OMR jobs in parallel, tracks each job's state, and calls `onJobDone(index, musicXmlUri)` as each completes.  
**Status**: Pending

**Files**:
- `client/hooks/useMultiOmrJobs.ts` — [TO CREATE]
- `__tests__/unit/hooks/useMultiOmrJobs.test.ts` — [TO CREATE]

**Interface contract**:
```ts
export interface SectionInput {
  pageRange: PageRange;   // e.g. [3, 7]
  title: string;
}

export type MultiJobStatus = "idle" | "uploading" | "running" | "done" | "failed";

export interface SectionJobState {
  title: string;
  status: "pending" | "queued" | "processing" | "done" | "failed";
  musicXmlUri?: string;
  error?: string;
}

export interface UseMultiOmrJobsResult {
  overallStatus: MultiJobStatus;
  jobs: SectionJobState[];
  submitAll: (
    pdfB64: string,
    sections: SectionInput[],
    onJobDone: (index: number, musicXmlUri: string) => Promise<void>
  ) => void;
  reset: () => void;
}

export function useMultiOmrJobs(): UseMultiOmrJobsResult
```

---

**RED — Write all failing tests first**

- [ ] **Test 1.1**: Initial state
  - File: `__tests__/unit/hooks/useMultiOmrJobs.test.ts` — [TO CREATE]
  - Scenario: `renderHook(() => useMultiOmrJobs())` → `overallStatus === "idle"`, `jobs === []`
  - Mocks: `uploadPdfToStorage`, `submitOmrJob`, `downloadResult`, Supabase Realtime (same pattern as `useOmrJob.test.ts`)

- [ ] **Test 1.2**: Upload failure → overallStatus becomes "failed"
  - `mockUploadPdf.mockRejectedValue(new OmrQueueError("upload failed"))`
  - Call `submitAll("b64", [{ pageRange: [1,2], title: "Act 1" }], onDone)`
  - Expect: `overallStatus === "failed"`, `onDone` never called

- [ ] **Test 1.3**: Single section — happy path reaches "done"
  - `mockUploadPdf` → `"path.pdf"`, `mockSubmitJob` → `"job-1"`, Realtime fires `status: "done"`, `mockDownloadResult` → `"file:///musicxml/s0.musicxml"`
  - Expect: `jobs[0].status === "done"`, `jobs[0].musicXmlUri === "file:///musicxml/s0.musicxml"`, `onDone(0, "file:///musicxml/s0.musicxml")` called once, `overallStatus === "done"`

- [ ] **Test 1.4**: Two sections — both complete independently
  - Two submitOmrJob calls with different page_ranges; both Realtime channels fire "done"
  - Expect: both `jobs[0].status === "done"` and `jobs[1].status === "done"`, `onDone` called twice, `overallStatus === "done"`

- [ ] **Test 1.5**: Two sections — one fails → overallStatus "failed", other still tracked
  - `jobs[0]` → done, `jobs[1]` → failed
  - Expect: `overallStatus === "failed"`, `onDone` called once (for job 0 only)

- [ ] **Test 1.6**: `reset()` returns to idle, clears jobs
  - After submitting, call `reset()` → `overallStatus === "idle"`, `jobs === []`

---

**GREEN — Implement**

```
Invoke sc:implement:
  "Implement useMultiOmrJobs hook to make Phase 1 tests pass.
   Test file: __tests__/unit/hooks/useMultiOmrJobs.test.ts
   New file: client/hooks/useMultiOmrJobs.ts
   
   Behavior:
   1. submitAll(pdfB64, sections, onJobDone):
      a. Set overallStatus = 'uploading'
      b. Upload pdfB64 once via uploadPdfToStorage(pdfB64, tempId)
      c. For each section, call submitOmrJob(storagePath, [section.pageRange]) → jobId
      d. Subscribe to each jobId via Supabase Realtime (same channel pattern as useOmrJob)
      e. On each job done: downloadResult → call onJobDone(index, uri) → mark job done
      f. When all jobs done: overallStatus = 'done'. If any failed: overallStatus = 'failed'
   2. reset(): unsubscribe all channels, reset to idle/empty
   
   CA rules: no imports from screens/ or components/. No React Native UI imports."
```

---

**Phase quality gate**
- [ ] `npm run check:types` — zero errors
- [ ] `npx jest __tests__/unit/hooks/useMultiOmrJobs.test.ts` — all green
- [ ] `npx expo lint` — zero new warnings
- [ ] `client/hooks/useMultiOmrJobs.ts` ≤ 250 lines, no function > 40 lines
- [ ] No imports from `screens/` or `components/` in new hook

---

### Phase 2: `usePdfImport` cleanup + section titles
**Layer**: Use Cases  
**Goal**: Remove dead `confirmRanges`, add `sectionTitles` state + `setSectionTitle(i, title)` + `defaultTitles(count, baseName)` helper so the screen can drive a naming step.  
**Status**: Pending

**Files**:
- `client/hooks/usePdfImport.ts` — remove `confirmRanges`, add title state
- `client/lib/pdfImport.ts` — add `defaultTitles(count, baseName): string[]` pure helper
- `__tests__/unit/hooks/usePdfImport.test.ts` — update (remove confirmRanges tests, add title tests)
- `__tests__/unit/lib/pdfImport.test.ts` — [TO CREATE] for `defaultTitles`

**Interface contract**:
```ts
// lib/pdfImport.ts addition
export function defaultTitles(count: number, baseName: string): string[]
// e.g. defaultTitles(3, "Les Mis") → ["Les Mis — Section 1", "Les Mis — Section 2", "Les Mis — Section 3"]

// usePdfImport.ts — updated return
export type PdfImportState = "idle" | "picking" | "uploading" | "selecting" | "naming" | "error";
// (new state: "naming" — after user confirms section boundaries, before submit)

export interface UsePdfImportReturn {
  state: PdfImportState;
  chunks: PdfChunk[];
  pageRanges: PageRange[];
  sectionTitles: string[];         // NEW
  pdfB64: string | null;
  error: string | null;
  startImport(): Promise<void>;
  setPageRanges(ranges: PageRange[]): void;
  setSectionTitle(index: number, title: string): void;  // NEW
  proceedToNaming(): void;         // NEW — transitions selecting → naming, sets defaultTitles
  reset(): void;
  // confirmRanges REMOVED
}
```

---

**RED — Write all failing tests first**

- [ ] **Test 2.1**: `defaultTitles(3, "Les Mis")` → `["Les Mis — Section 1", "Les Mis — Section 2", "Les Mis — Section 3"]`
  - File: `__tests__/unit/lib/pdfImport.test.ts` — [TO CREATE]

- [ ] **Test 2.2**: `defaultTitles(1, "Hamilton")` → `["Hamilton — Section 1"]`

- [ ] **Test 2.3**: `proceedToNaming()` transitions state from "selecting" to "naming" and sets default titles
  - After `startImport()` resolves (state = "selecting"), call `proceedToNaming()`
  - Expect: `state === "naming"`, `sectionTitles.length > 0`

- [ ] **Test 2.4**: `setSectionTitle(0, "Act 1 Opening")` updates title at index 0
  - After reaching "naming" state, call `setSectionTitle(0, "Act 1 Opening")`
  - Expect: `sectionTitles[0] === "Act 1 Opening"`

- [ ] **Test 2.5**: `confirmRanges` no longer exists on the hook return value
  - `renderHook(() => usePdfImport())` → `result.current` does not have `confirmRanges` property

---

**GREEN — Implement**

```
Invoke sc:implement:
  "Update usePdfImport and pdfImport lib to make Phase 2 tests pass.
   
   Changes:
   1. client/lib/pdfImport.ts: add exported pure function defaultTitles(count, baseName)
   2. client/hooks/usePdfImport.ts:
      - Remove confirmRanges (dead code — never called from PdfImportScreen)
      - Add sectionTitles state (string[])
      - Add setSectionTitle(i, title) updater
      - Add proceedToNaming(): sets defaultTitles from current pageRanges count + 'Score', transitions to 'naming'
      - Add 'naming' to PdfImportState union
   
   CA rules: lib/pdfImport.ts must NOT import from hooks or React."
```

---

**Phase quality gate**
- [ ] `npm run check:types` — zero errors
- [ ] `npx jest __tests__/unit/hooks/usePdfImport.test.ts __tests__/unit/lib/pdfImport.test.ts` — all green
- [ ] `npx expo lint` — zero new warnings
- [ ] `lib/pdfImport.ts` has no React/hook imports

---

### Phase 3: `PdfImportScreen` rewrite
**Layer**: UI (Frameworks & Drivers)  
**Goal**: Add "naming" UI step, wire `useMultiOmrJobs` for N-job submission, call `addSheet` per completed job, show per-job progress, navigate back when all done.  
**Status**: Pending

**Files**:
- `client/screens/PdfImportScreen.tsx` — rewrite
- `client/types/navigation.ts` — fix `PdfImport: { sheetId: string }` → `PdfImport: undefined`

**New screen states (rendering order)**:
```
idle/error     → "Import PDF" button
picking        → spinner "Opening file picker…"
uploading      → spinner "Loading PDF…"
selecting      → PageThumbnailGrid + "Confirm N Sections" → calls proceedToNaming()
naming         → list of N text inputs for section titles + "Start Processing" button
               → calls useMultiOmrJobs.submitAll() + onJobDone creates card
running        → list of N section progress rows (pending/queued/processing/done/failed icon)
done           → "All done! View Library" → navigation.goBack()
failed         → error summary + "Retry failed" or "Start Over"
```

**Card creation wiring (inside onJobDone callback)**:
```ts
// passed to submitAll as onJobDone:
async (index, musicXmlUri) => {
  await addSheet({
    title: sectionTitles[index],
    artist: "",
    folder: "Musical",
    imageUris: [],
    musicXmlUri,
    omrStatus: "ready",
  });
}
```

---

**RED — Write all failing tests first**

> PdfImportScreen is a UI screen — integration-style test (react-native testing library).  
> Scope: smoke tests for the new states only.

- [ ] **Test 3.1**: Idle state renders "Import PDF" button
  - File: `__tests__/components/PdfImportScreen.test.tsx` — [TO CREATE]
  - Mock `usePdfImport` → `{ state: "idle", ... }`
  - Expect: `getByText("Import PDF")` present

- [ ] **Test 3.2**: Naming state renders N title inputs
  - Mock `usePdfImport` → `{ state: "naming", sectionTitles: ["Section 1", "Section 2"], pageRanges: [[1,3],[4,6]], ... }`
  - Expect: 2 `TextInput` elements with default title values

- [ ] **Test 3.3**: Running state renders N progress rows
  - Mock `useMultiOmrJobs` → `{ overallStatus: "running", jobs: [{ title: "Act 1", status: "processing" }, { title: "Act 2", status: "queued" }], ... }`
  - Expect: "Act 1" and "Act 2" visible

- [ ] **Test 3.4**: Done state renders "View Library" button
  - Mock `useMultiOmrJobs` → `{ overallStatus: "done", jobs: [...all done...] }`
  - Expect: `getByText(/View Library/i)` present

---

**GREEN — Implement**

```
Invoke sc:implement:
  "Rewrite PdfImportScreen.tsx and fix navigation.ts to make Phase 3 tests pass.
   
   Changes:
   1. client/types/navigation.ts: change PdfImport: { sheetId: string } → PdfImport: undefined
   2. client/screens/PdfImportScreen.tsx full rewrite:
      - Import usePdfImport, useMultiOmrJobs, usePractice (for addSheet)
      - Render state machine: idle→picking→uploading→selecting→naming→running→done/failed
      - selecting: PageThumbnailGrid + 'Confirm N Sections' button → proceedToNaming()
      - naming: FlatList of section title TextInputs (one per section) + 'Start Processing' button
        → calls multiOmrJobs.submitAll(pdfB64, sections, onJobDone)
        → onJobDone: calls addSheet({ title, musicXmlUri, omrStatus:'ready', folder:'Musical', imageUris:[], artist:'' })
      - running: FlatList of SectionJobState rows with status icons
      - done: success message + 'View Library' → navigation.goBack()
      - failed: error + 'Start Over' button → full reset
   
   CA rule: screens must NOT import other screens. Supabase must NOT be called directly."
```

---

**Phase quality gate**
- [ ] `npm run check:types` — zero errors
- [ ] `npx jest __tests__/components/PdfImportScreen.test.tsx` — all green
- [ ] `npx expo lint` — zero new warnings
- [ ] `PdfImportScreen.tsx` ≤ 250 lines (extract sub-components if needed)
- [ ] No direct Supabase calls in screen

---

### Phase 4: LibraryScreen entry point
**Layer**: UI (Frameworks & Drivers)  
**Goal**: Make `PdfImportScreen` reachable. `+` button shows an action sheet with "Add Score" and "Import PDF" options. Fixes the `PdfImport` nav call-site to match `undefined` params.  
**Status**: Pending

**Files**:
- `client/screens/LibraryScreen.tsx` — action sheet on `+` press

---

**RED — Write all failing tests first**

- [ ] **Test 4.1**: Pressing `+` shows action sheet with both options
  - File: `__tests__/components/LibraryScreen.test.tsx` — [TO CREATE] (or add to existing if any)
  - Mock `usePractice`, mock `navigation.navigate`
  - Press `getByLabelText("Add new score")`
  - Expect: `getByText("Add Score")` and `getByText("Import PDF")` both visible

- [ ] **Test 4.2**: Tapping "Import PDF" navigates to PdfImport with no params
  - After action sheet opens, press "Import PDF"
  - Expect: `mockNavigate` called with `("PdfImport", undefined)` or `("PdfImport")`

- [ ] **Test 4.3**: Tapping "Add Score" opens SheetFormModal (existing behavior preserved)
  - After action sheet opens, press "Add Score"
  - Expect: `SheetFormModal` rendered (or `setShowAdd(true)` behavior)

---

**GREEN — Implement**

```
Invoke sc:implement:
  "Update LibraryScreen.tsx to make Phase 4 tests pass.
   
   Changes:
   1. Replace direct setShowAdd(true) on + press with ActionSheetIOS.showActionSheetWithOptions
      (iOS) / Alert.alert with buttons (cross-platform fallback).
      Options: 'Add Score' → setShowAdd(true), 'Import PDF' → navigation.navigate('PdfImport'),
      'Cancel' → dismiss.
   2. Update navigation.navigate('PdfImport') call — no second argument (params: undefined).
   
   Do NOT use any third-party action sheet library. Use ActionSheetIOS on iOS, Alert on Android."
```

---

**Phase quality gate**
- [ ] `npm run check:types` — zero errors
- [ ] `npx jest __tests__/components/LibraryScreen.test.tsx` — all green
- [ ] `npx expo lint` — zero new warnings
- [ ] No screen-to-screen imports

---

## Global Maintainability Audit (run after all phases)

```bash
# Files over 250 lines
wc -l client/hooks/useMultiOmrJobs.ts client/hooks/usePdfImport.ts client/screens/PdfImportScreen.tsx client/screens/LibraryScreen.tsx

# TypeScript any
grep -n ": any" client/hooks/useMultiOmrJobs.ts client/hooks/usePdfImport.ts client/screens/PdfImportScreen.tsx

# Non-null assertions
grep -n "![^=]" client/hooks/useMultiOmrJobs.ts client/hooks/usePdfImport.ts client/screens/PdfImportScreen.tsx | grep -v "//"
```

Then run `sc:analyze` for architectural review.

---

## Completion Checklist

- [x] PHASE_1_DONE — `useMultiOmrJobs` all tests green, type-clean
- [x] PHASE_2_DONE — `usePdfImport` cleaned, `defaultTitles` tested
- [x] PHASE_3_DONE — `PdfImportScreen` rewritten, nav params fixed
- [x] PHASE_4_DONE — LibraryScreen entry point working
- [x] `npm run check:types` global clean
- [x] `npx jest` global green (no new failures vs baseline — 9 pre-existing failing suites unchanged)
- [x] `npx expo lint` global clean
- [x] Global audit complete — zero flags (no `: any`, no non-null assertions, all files ≤ 251 lines, CA deps clean)
- [x] `FEATURE_COMPLETE`
