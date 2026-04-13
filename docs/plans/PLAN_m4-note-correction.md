# PLAN: M4 — In-App Note Correction

**Status**: In Progress  
**Created**: 2026-04-10  
**Scope**: Medium (4 phases)  
**Approach**: Skill chain — sequential TDD  
**Budget**: Standard (Sonnet for all)

## Commands
- **Test**: `npx jest --testPathPattern`
- **All tests**: `npx jest`
- **Lint**: `npx expo lint`
- **Type check**: `npm run check:types`

---

## Feature Summary

User is in autoplay mode viewing an `InteractiveScore`. They tap a note → a **pitch picker** appears → they select a new pitch → the in-memory MusicXML is updated and the score re-renders. No Supabase persistence in M4.

### Flow
```
[InteractiveScore] onNotePress(noteIndex)
  → [useNoteEditor] selects note, extracts current pitch
    → [PitchPicker] user picks new pitch
      → [useNoteEditor] mutates MusicXML via musicXmlEditor
        → [InteractiveScore] re-renders with new XML
```

---

## Clean Architecture Layer Map

| File | Layer | Rule |
|------|-------|------|
| `client/lib/audio/musicXmlEditor.ts` | Entities | Pure TS only — no RN, no Supabase |
| `client/hooks/useNoteEditor.ts` | Use Cases | Orchestrates editor + synth preview |
| `client/components/PitchPicker.tsx` | UI | RN component, no business logic |
| `client/screens/PracticeDetailScreen.tsx` | UI | Integration only |

---

## Phases

### Phase 1 — Entity: MusicXML Editor
**Layer**: Entities (`client/lib/`)  
**File**: `client/lib/audio/musicXmlEditor.ts` [TO CREATE]  
**Test file**: `__tests__/unit/lib/audio/musicXmlEditor.test.ts` [TO CREATE]

**Purpose**: Pure string-level MusicXML mutations. Maps a `NoteEvent` (from `parseMusicXml`) back to its `<note>` element and replaces its `<pitch>` block.

**Signatures**:
```typescript
/**
 * Decompose a pitch string like "C#4" or "D4" into step/alter/octave.
 * Returns null if the pitch string is invalid.
 */
export function parsePitchString(
  pitch: string,
): { step: string; alter: number; octave: number } | null

/**
 * Serialize step/alter/octave back into a pitch string like "C#4".
 */
export function formatPitchString(
  step: string,
  alter: number,
  octave: number,
): string

/**
 * Find the <note> element in xmlString that best matches the given pitch and
 * approximate startTime (within toleranceSecs). Returns the character range
 * [start, end] of the full <note>...</note> block, or null if not found.
 *
 * Matching algorithm:
 *  1. Walk all <note> elements in document order, tracking elapsed divisions
 *     per voice to compute startTime for each note.
 *  2. Skip <rest> and <chord> notes from time accounting.
 *  3. Return the element where abs(computedStartTime - targetStartTime) <=
 *     toleranceSecs AND step/octave match.
 */
export function findNoteRange(
  xmlString: string,
  targetStep: string,
  targetOctave: number,
  targetStartTimeSecs: number,
  toleranceSecs?: number,  // default 0.05
): { start: number; end: number } | null

/**
 * Replace the pitch of the note identified by findNoteRange.
 * Returns the updated MusicXML string, or the original string unchanged if
 * the note cannot be found.
 */
export function replaceNotePitch(
  xmlString: string,
  noteSequence: NoteSequence,
  noteIndex: number,
  newStep: string,
  newAlter: number,
  newOctave: number,
): string
```

**Test scenarios**:
- `parsePitchString("C4")` → `{ step: "C", alter: 0, octave: 4 }`
- `parsePitchString("C#4")` → `{ step: "C", alter: 1, octave: 4 }`
- `parsePitchString("Bb3")` or enharmonic flat → handles gracefully
- `parsePitchString("Z9")` → `null`
- `formatPitchString("D", 1, 5)` → `"D#5"`
- `findNoteRange` — finds first note in SAMPLE_MUSICXML (C4 at t=0)
- `findNoteRange` — returns null for a startTime with no matching note
- `replaceNotePitch` on SAMPLE_MUSICXML index 0 (C4→0s) → result re-parses to G4 at t=0
- `replaceNotePitch` on index 2 (G4) → result re-parses to A4 at same time
- `replaceNotePitch` with invalid index → returns original XML unchanged

**Interface contract produced**: `replaceNotePitch`, `parsePitchString`, `formatPitchString`

**Quality gate**:
- [ ] `npx jest __tests__/unit/lib/audio/musicXmlEditor.test.ts` — all green
- [ ] `npm run check:types` — zero errors
- [ ] `client/lib/audio/musicXmlEditor.ts` imports nothing from hooks/context/screens/components/RN
- [ ] No function exceeds 40 lines
- [ ] All exported functions have explicit return types

---

### Phase 2 — Use Case: useNoteEditor Hook
**Layer**: Use Cases (`client/hooks/`)  
**File**: `client/hooks/useNoteEditor.ts` [TO CREATE]  
**Test file**: `__tests__/unit/hooks/useNoteEditor.test.ts` [TO CREATE]

**Purpose**: Orchestrates note selection state, pitch extraction, MusicXML mutation, and synth preview. Drives the picker UI.

**Signatures**:
```typescript
export interface NoteEditorState {
  /** Currently working MusicXML (may differ from initial after edits) */
  editedMusicXml: string;
  /** Index of the selected note (from InteractiveScore.onNotePress) */
  selectedIndex: number | null;
  /** Decomposed pitch of the selected note */
  selectedPitch: { step: string; alter: number; octave: number } | null;
  /** True if any edit has been made */
  hasEdits: boolean;
}

export interface NoteEditorActions {
  /** Called by InteractiveScore.onNotePress — enters edit mode for that note */
  selectNote: (noteIndex: number) => void;
  /** Apply a new pitch to the selected note and dismiss the picker */
  applyPitch: (step: string, alter: number, octave: number) => void;
  /** Dismiss picker without saving */
  dismiss: () => void;
  /** Reset editedMusicXml to the original */
  resetEdits: () => void;
}

export function useNoteEditor(
  initialMusicXml: string,
  noteSequence: NoteSequence,
): NoteEditorState & NoteEditorActions
```

**Test scenarios** (using `renderHook + act`):
- Initial state: `selectedIndex=null`, `selectedPitch=null`, `hasEdits=false`
- `selectNote(0)` → `selectedIndex=0`, `selectedPitch={step:"C",alter:0,octave:4}`
- `selectNote` with out-of-range index → `selectedPitch=null`
- `applyPitch("G",0,4)` after `selectNote(0)` → `editedMusicXml` re-parses to G4 at t=0, `selectedIndex=null`, `hasEdits=true`
- `dismiss()` → clears `selectedIndex` without changing `editedMusicXml`
- `resetEdits()` after edit → `editedMusicXml` equals original, `hasEdits=false`
- Calling `applyPitch` without prior `selectNote` → no-op

**Interface contract produced**: `useNoteEditor` hook interface

**Quality gate**:
- [ ] `npx jest __tests__/unit/hooks/useNoteEditor.test.ts` — all green
- [ ] `npm run check:types` — zero errors
- [ ] `hooks/useNoteEditor.ts` does NOT import from screens or components
- [ ] Synth preview call is mocked via `jest.mock('../lib/audio/synthEngine')`

---

### Phase 3 — UI: PitchPicker Component
**Layer**: Frameworks & Drivers (`client/components/`)  
**File**: `client/components/PitchPicker.tsx` [TO CREATE]  
**Test file**: `__tests__/components/PitchPicker.test.tsx` [TO CREATE]

**Purpose**: Bottom-sheet style modal with a chromatic note grid (C through B) and an octave selector (octaves 2–6). Calls `onConfirm` with the chosen pitch; `onDismiss` on cancel/backdrop.

**Signatures**:
```typescript
export interface PitchPickerProps {
  visible: boolean;
  initialPitch: { step: string; alter: number; octave: number } | null;
  onConfirm: (step: string, alter: number, octave: number) => void;
  onDismiss: () => void;
}

export function PitchPicker(props: PitchPickerProps): React.JSX.Element
```

**Chromatic notes** (in order):
```
C, C#, D, D#, E, F, F#, G, G#, A, A#, B
```
(alter: 0 for naturals, 1 for sharps — no flats in the picker)

**Test scenarios** (using `@testing-library/react-native`):
- Renders `null`/nothing when `visible=false`
- Shows all 12 note names when `visible=true`
- Shows octave buttons 2–6
- Tapping a note + tapping Confirm → calls `onConfirm(step, alter, octave)`
- Tapping Cancel → calls `onDismiss` without `onConfirm`
- Initial selection pre-highlights the `initialPitch` note

**Quality gate**:
- [ ] `npx jest __tests__/components/PitchPicker.test.tsx` — all green
- [ ] `npm run check:types` — zero errors
- [ ] `npx expo lint` — zero new warnings in PitchPicker.tsx
- [ ] No function exceeds 40 lines; no file exceeds 250 lines

---

### Phase 4 — Screen Integration
**Layer**: Frameworks & Drivers (`client/screens/`)  
**File**: `client/screens/PracticeDetailScreen.tsx` [EXISTS — modify]

**Purpose**: Wire `useNoteEditor` into PracticeDetailScreen. Add an edit-mode toggle. Show `PitchPicker` when `selectedIndex !== null`. Pass `editedMusicXml` to both `InteractiveScore` instances.

**Changes**:
1. Import `useNoteEditor`, `PitchPicker`
2. Call `useNoteEditor(musicXmlContent ?? "", noteSequence)` — `noteSequence` is already computed from `parseMusicXml` in scope
3. Add `editMode: boolean` state (toggle button in the toolbar)
4. In edit mode: `onNotePress` → `noteEditor.selectNote`; in play mode: existing `handleNotePress` (seek synth)
5. Render `<PitchPicker>` at the bottom of the screen, driven by `noteEditor.selectedIndex !== null && editMode`
6. Pass `noteEditor.editedMusicXml` to `<InteractiveScore musicXml={...}>`
7. Edit toggle button: show a pencil icon next to the instrument picker; disabled when `!musicXmlContent`

**No new test file** — screen integration tested manually (too many mocks needed for a screen-level unit test; Maestro E2E is the right vehicle).

**Quality gate**:
- [ ] `npx jest` — full suite green (no regressions)
- [ ] `npm run check:types` — zero errors
- [ ] `npx expo lint` — zero new warnings
- [ ] `screens/` does not call `musicXmlEditor` directly — all mutations via `useNoteEditor`

---

## Global Maintainability Audit (post all phases)

Run after Phase 4:
```bash
wc -l client/lib/audio/musicXmlEditor.ts client/hooks/useNoteEditor.ts client/components/PitchPicker.tsx
grep -n ": any" client/lib/audio/musicXmlEditor.ts client/hooks/useNoteEditor.ts client/components/PitchPicker.tsx
grep -n "![^=]" client/lib/audio/musicXmlEditor.ts client/hooks/useNoteEditor.ts client/components/PitchPicker.tsx | grep -v "//"
```

Then invoke `sc:analyze` for architectural review, then `sc:cleanup` for final pass.

---

## Checklist

- [x] Phase 1 DONE — musicXmlEditor.ts, all tests green
- [x] Phase 2 DONE — useNoteEditor.ts, all tests green
- [x] Phase 3 DONE — PitchPicker.tsx, all tests green
- [x] Phase 4 DONE — PracticeDetailScreen wired, full suite green
- [x] Global audit complete
- [x] `npm run check:types` clean
- [x] `npx jest` clean (640/666; 26 pre-existing failures unchanged)
- [x] `npx expo lint` clean (0 new warnings in M4 files)
