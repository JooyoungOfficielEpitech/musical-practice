# Implementation Plan: PracticeDetailScreen Refactor

**Status**: In Progress  
**Approach**: Skill Chain  
**Started**: 2026-04-10  
**Last Updated**: 2026-04-10

---

> **Protocol**: Per phase — write ALL failing tests first (RED), verify they fail, implement (GREEN), refactor (REFACTOR), run full quality gate. Never advance with failing checks.

---

## Overview

**What it does**: Splits `PracticeDetailScreen.tsx` (1221 lines) into a use-case hook + two subcomponents + a thin shell screen, with zero behaviour change.  
**Why it's needed**: File exceeds the 250-line budget 5×. Business logic, UI, and styles are co-located in a single file, violating CA and making the file unmaintainable.

**Detected commands**:
- Type check: `npx tsc --noEmit`
- Tests: `npm test`
- Lint: `npx expo lint`

---

## Success Criteria
- [ ] `PracticeDetailScreen.tsx` ≤ 150 lines
- [ ] `usePracticeDetail.ts` ≤ 250 lines
- [ ] `PracticeActiveView.tsx` ≤ 150 lines
- [ ] `PracticeBrowseView.tsx` ≤ 300 lines
- [ ] All 9 existing `PracticeDetailScreen.test.tsx` tests still pass
- [ ] Zero new `any` types introduced
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx expo lint` — zero new warnings

---

## Architecture Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Extract all state into `usePracticeDetail` | Keeps use-case logic testable without rendering | Hook is large but cohesive; alternative is multiple hooks which adds inter-hook coupling |
| `PracticeBrowseView` and `PracticeActiveView` as separate components | Each mode has its own layout tree, styles, and ~80% exclusive code | Props surface is wide but explicit |
| `useNavigation` inside `usePracticeDetail` | Avoids threading navigation callbacks through props | Hook imports from RN ecosystem (allowed by CA) |
| `formatSynthTime` moved to `usePracticeDetail` | Pure helper used only in autoplay UI; no reason to expose as lib | Not reusable elsewhere — fine to colocate |

---

## Dependencies

**Confirmed existing files this feature depends on:**
- [x] `client/screens/PracticeDetailScreen.tsx` (1221 lines — to be thinned)
- [x] `__tests__/components/PracticeDetailScreen.test.tsx` (9 existing tests — must keep passing)
- [x] `client/hooks/useSynthPlayer.ts`
- [x] `client/hooks/useNoteEditor.ts`
- [x] `client/hooks/useAudioPlayer.ts`
- [x] `client/hooks/usePitchDetection.ts`
- [x] `client/hooks/usePitchAccuracy.ts`
- [x] `client/hooks/useAudioPermission.ts`
- [x] `client/hooks/useRecording.ts`
- [x] `client/hooks/useOmr.ts`
- [x] `client/context/PracticeContext.tsx`
- [x] `client/lib/audio/musicXmlParser.ts`
- [x] `client/types/music.ts`
- [x] `client/lib/storage.ts` (SheetMusic, PracticeSession types)

**New packages**: none

---

## Phase Breakdown

---

### Phase 1: Extract `usePracticeDetail` hook
**Layer**: Use Cases  
**Goal**: All state, effects, and handlers live in one testable hook. Screen only calls it.  
**Status**: Pending

**Files:**
- `client/hooks/usePracticeDetail.ts` — [TO CREATE]
- `__tests__/unit/hooks/usePracticeDetail.test.ts` — [TO CREATE]

**Interface contract:**
```ts
export type AudioMode = "reference" | "autoplay";

export interface SessionResult {
  duration: number;
  accuracy: number;
  bpm: number;
  recordingSaved: boolean;
}

export interface PracticeDetailState {
  // UI control state (modals, toggles)
  currentBpm: number;
  setCurrentBpm: (bpm: number) => void;
  showMetronome: boolean;
  showEdit: boolean;
  setShowEdit: (show: boolean) => void;
  isPracticing: boolean;
  isStartingPractice: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  sessionResult: SessionResult | null;
  setSessionResult: (r: SessionResult | null) => void;
  audioMode: AudioMode;
  setAudioMode: (mode: AudioMode) => void;
  musicXmlContent: string | null;
  musicXmlLoading: boolean;
  hasMusicXml: boolean;
  showInstrumentPicker: boolean;
  setShowInstrumentPicker: (show: boolean) => void;
  editMode: boolean;

  // Derived
  noteSequence: NoteSequence;
  sheetSessions: PracticeSession[];
  bestScore: number | null;
  sheetRecordings: Recording[];

  // Sub-hook returns (passed through)
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  noteEditor: ReturnType<typeof useNoteEditor>;
  isListening: boolean;
  currentPitch: PitchResult | null;
  pitchError: string | null;
  sessionAccuracy: number;
  isRecording: boolean;
  omr: ReturnType<typeof useOmr>;

  // Handlers
  handleNotePress: (noteIndex: number) => void;
  handleSynthPlayPause: () => Promise<void>;
  handleTimerStart: () => Promise<boolean>;
  handleSessionStop: (totalSeconds: number) => Promise<void>;
  handleRunningChange: (running: boolean) => void;
  handleScanSheet: () => Promise<void>;
  handleStartPractice: () => Promise<void>;
  handleDeletePress: () => void;
  handleDeleteConfirm: () => Promise<void>;
  toggleMetronome: () => void;
  handleEdit: (data: SheetFormData) => Promise<void>;
}

export function usePracticeDetail(sheetId: string): PracticeDetailState
```

---

**RED — Write all failing tests first**
- [ ] **Test 1.1**: Hook initialises with correct default state
  - File: `__tests__/unit/hooks/usePracticeDetail.test.ts` — [TO CREATE]
  - Scenario: render hook with `sheetId = "sheet-1"` (mock PracticeContext); `isPracticing`, `showMetronome`, `showEdit`, `editMode` all start `false`; `currentBpm` starts `120`; `audioMode` defaults to `"reference"`
  - Expected failure: `Cannot find module '../../client/hooks/usePracticeDetail'`
  - Mocks: PracticeContext, useAudioPlayer, usePitchDetection, usePitchAccuracy, useAudioPermission, useRecording, useOmr, useSynthPlayer, useNoteEditor, useNavigation

- [ ] **Test 1.2**: `audioMode` auto-selects to `"autoplay"` when sheet has `musicXmlUri` but no `audioUri`
  - Same file
  - Scenario: sheet has `musicXmlUri: "file://x.xml"`, no `audioUri`; after render `audioMode === "autoplay"`
  - Expected failure: module not found

- [ ] **Test 1.3**: `toggleMetronome` flips `showMetronome`
  - Same file
  - Scenario: call `result.current.toggleMetronome()` → `showMetronome` becomes `true`; call again → `false`
  - Expected failure: module not found

- [ ] **Test 1.4**: `handleDeletePress` sets `showDeleteConfirm` to `true`
  - Same file
  - Scenario: call `handleDeletePress()` → `showDeleteConfirm === true`
  - Expected failure: module not found

- [ ] **Test 1.5**: `bestScore` is `null` when no sessions exist
  - Same file
  - Scenario: context returns empty sessions array → `bestScore === null`
  - Expected failure: module not found

*Verify all 5 tests FAIL before proceeding to GREEN.*

---

**GREEN — Implement to make tests pass**
- [ ] **Task 1.6**: Create `client/hooks/usePracticeDetail.ts` — move all state, effects, and handlers from `PracticeDetailScreen.tsx` lines 62–390. Return `PracticeDetailState`.
- [ ] **Task 1.7**: Remove extracted state/handlers from `PracticeDetailScreen.tsx` — replace with single `usePracticeDetail(sheetId)` call and destructuring.

---

**REFACTOR — Clean up while tests stay green**
- [ ] **Task 1.8**: Ensure no handler exceeds 40 lines — split `handleTimerStart` and `handleSessionStop` into private helpers if needed.
- [ ] **Task 1.9**: Verify no `any` or unexplained `!` in the new hook.

---

**Phase 1 Quality Gate**

*Stop. Do NOT proceed to Phase 2 until all pass.*

Build & tests:
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npm test` — all green (existing 9 + new 5 = 14 pass)
- [ ] `npx expo lint` — zero errors
- [ ] Tests were written first and initially failed

Clean Architecture:
- [ ] `usePracticeDetail.ts` imports nothing from `screens/` or `components/`
- [ ] No `View`, `Text`, `Pressable`, `StyleSheet` imports in `usePracticeDetail.ts`

Clean code:
- [ ] `usePracticeDetail.ts` ≤ 250 lines
- [ ] No function > 40 lines
- [ ] No `any` type
- [ ] No unexplained `!`

`PHASE_1_DONE` ✓

---

### Phase 2: Extract `PracticeActiveView`
**Layer**: UI (Frameworks & Drivers)  
**Goal**: The practicing-mode render tree lives in its own component.  
**Status**: Pending

**Files:**
- `client/components/PracticeActiveView.tsx` — [TO CREATE]
- `__tests__/components/PracticeActiveView.test.tsx` — [TO CREATE]

**Interface contract:**
```ts
export interface PracticeActiveViewProps {
  sheet: SheetMusic;
  audioMode: AudioMode;
  musicXmlContent: string | null;
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  noteEditor: ReturnType<typeof useNoteEditor>;
  editMode: boolean;
  handleNotePress: (noteIndex: number) => void;
  isListening: boolean;
  currentPitch: PitchResult | null;
  pitchError: string | null;
  sessionAccuracy: number;
  isRecording: boolean;
  currentBpm: number;
  setCurrentBpm: (bpm: number) => void;
  topBarHeight: number;
  practiceContentHeight: number;
}

export function PracticeActiveView(props: PracticeActiveViewProps): React.JSX.Element
```

---

**RED:**
- [ ] **Test 2.1**: Renders top bar with sheet title in practice mode
  - File: `__tests__/components/PracticeActiveView.test.tsx` — [TO CREATE]
  - Scenario: render with `sheet.title = "La Traviata"` → `getByText("La Traviata")` truthy
  - Expected failure: module not found
  - Mocks: standard theme/icon mocks; `FloatingPitchPanel` → null; `InteractiveScore` → null; `SheetMusicViewer` → null

- [ ] **Test 2.2**: Shows `InteractiveScore` when `audioMode === "autoplay"` and `musicXmlContent` non-null
  - Same file
  - Scenario: `audioMode = "autoplay"`, `musicXmlContent = "<score/>"` → `getByLabelText("Interactive Score")` (or testID check) truthy
  - Expected failure: module not found

- [ ] **Test 2.3**: Shows `SheetMusicViewer` when `audioMode === "reference"`
  - Same file
  - Scenario: `audioMode = "reference"` → SheetMusicViewer rendered, InteractiveScore not
  - Expected failure: module not found

*Verify all 3 tests FAIL before proceeding.*

---

**GREEN:**
- [ ] **Task 2.4**: Create `client/components/PracticeActiveView.tsx` — cut the `isPracticing` render subtree from `PracticeDetailScreen.tsx` (lines ~415–480) into this component.
- [ ] **Task 2.5**: Import and render `PracticeActiveView` in `PracticeDetailScreen.tsx` where the old `isPracticing` block was.

---

**REFACTOR:**
- [ ] **Task 2.6**: Move all styles used only by `PracticeActiveView` out of the screen's StyleSheet into the component's own StyleSheet.

---

**Phase 2 Quality Gate**

Build & tests:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes (all prior + new 3)
- [ ] `npx expo lint` passes
- [ ] TDD cycle followed

Clean code:
- [ ] `PracticeActiveView.tsx` ≤ 150 lines
- [ ] `PracticeDetailScreen.tsx` line count dropped by at least 250 lines vs. Phase 1 end
- [ ] No `any`, no unexplained `!`

`PHASE_2_DONE` ✓

---

### Phase 3: Extract `PracticeBrowseView`
**Layer**: UI (Frameworks & Drivers)  
**Goal**: The browse-mode scroll tree lives in its own component.  
**Status**: Pending

**Files:**
- `client/components/PracticeBrowseView.tsx` — [TO CREATE]
- `__tests__/components/PracticeBrowseView.test.tsx` — [TO CREATE]

**Interface contract:**
```ts
export interface PracticeBrowseViewProps {
  sheet: SheetMusic;
  state: PracticeDetailState; // full hook output
  screenWidth: number;
  loading: boolean;
  onRefresh: () => void;
}

export function PracticeBrowseView(props: PracticeBrowseViewProps): React.JSX.Element
```

---

**RED:**
- [ ] **Test 3.1**: Renders sheet title and artist in top bar
  - File: `__tests__/components/PracticeBrowseView.test.tsx` — [TO CREATE]
  - Scenario: sheet with title/artist → both visible
  - Expected failure: module not found

- [ ] **Test 3.2**: Shows "Scan Sheet Music" button when `omrStatus !== "ready"` and `imageUris` non-empty
  - Same file
  - Scenario: sheet has `imageUris: ["x.jpg"]`, `omrStatus: "none"` → `getByLabelText("Scan sheet music for auto-play")` truthy

- [ ] **Test 3.3**: Does NOT show "Scan Sheet Music" when `omrStatus === "ready"`
  - Same file
  - Scenario: `omrStatus: "ready"` → button absent

- [ ] **Test 3.4**: Shows "Start Practice" CTA
  - Same file
  - Scenario: → `getByLabelText("Start practice session")` truthy

*Verify all 4 tests FAIL before proceeding.*

---

**GREEN:**
- [ ] **Task 3.5**: Create `client/components/PracticeBrowseView.tsx` — cut the browse-mode tree (TopBar + ScrollView content, lines ~480–880) into this component.
- [ ] **Task 3.6**: Replace browse-mode block in `PracticeDetailScreen.tsx` with `<PracticeBrowseView>`.

---

**REFACTOR:**
- [ ] **Task 3.7**: Move styles used only by `PracticeBrowseView` into its own StyleSheet.
- [ ] **Task 3.8**: Verify `PracticeDetailScreen.tsx` is now ≤ 150 lines.

---

**Phase 3 Quality Gate**

Build & tests:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes (all prior + new 4)
- [ ] `npx expo lint` passes

Clean code:
- [ ] `PracticeBrowseView.tsx` ≤ 300 lines
- [ ] `PracticeDetailScreen.tsx` ≤ 150 lines — **hard gate**
- [ ] All touched files ≤ 250 lines (except `PracticeBrowseView` which is allowed up to 300 due to styles)
- [ ] No `any`, no unexplained `!`

`PHASE_3_DONE` ✓

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `PracticeDetailState` interface becomes unwieldy (30+ fields) | Medium | Low | Group into sub-objects if needed during REFACTOR |
| Styles cut from screen break existing test selectors | Low | Low | Existing tests use `accessibilityLabel`, not style-based selectors |
| `handleTimerStart` > 40 lines after extraction | High | Low | Split into `setupAudioSession` + `startCapture` private helpers in the hook |

---

## Global Maintainability Audit

*Filled in after all phases complete.*

**Script sweep:**
- [ ] `wc -l` on all 4 touched/created files — all within budget
- [ ] `grep -n ": any"` across all new files — zero hits
- [ ] `grep -n "![^=]"` across new files — zero unexplained hits

**Architectural review (sc:analyze):**
- [ ] `usePracticeDetail.ts` — no UI imports
- [ ] `PracticeActiveView.tsx` / `PracticeBrowseView.tsx` — no direct hook calls beyond prop consumption

**Tech debt logged:**
- None anticipated — pure structural move

---

## Progress Tracking

| Phase | Status | Est. |
|-------|--------|------|
| Phase 1: Extract hook | Pending | 1.5h |
| Phase 2: PracticeActiveView | Pending | 0.5h |
| Phase 3: PracticeBrowseView | Pending | 1h |
| **Total** | | **3h** |

---

**Plan Status**: In Progress  
**Next Action**: User approval → Phase 1 RED  
**Blocked By**: None
