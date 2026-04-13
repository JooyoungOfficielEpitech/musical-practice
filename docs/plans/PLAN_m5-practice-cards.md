# Implementation Plan: M5 — Practice Cards

**Status**: In Progress  
**Approach**: Skill Chain  
**Started**: 2026-04-10  
**Last Updated**: 2026-04-10

---

> **Protocol**: Per phase — write ALL failing tests first (RED), verify they fail, implement (GREEN), refactor (REFACTOR), run full quality gate. Never advance with failing checks.

---

## Overview

**What it does**: Enriches LibraryScreen cards with an OMR status badge and last-practiced accuracy display.  
**Why it's needed**: Cards currently show no OMR processing state or practice history — users have no at-a-glance feedback on which scores are ready or how well they last played them.

**Detected commands**:
- Type check: `npm run check:types`
- Tests: `npx jest`
- Lint: `npm run lint`

---

## Success Criteria
- [ ] SheetCard shows OMR status badge for `processing`, `ready`, and `failed` states (not `none`)
- [ ] SheetCard shows last-practiced accuracy (e.g. "87%") when a session exists for that sheet
- [ ] No accuracy displayed when no sessions exist for that sheet
- [ ] Pure utility functions are unit-tested independently of React
- [ ] All existing SheetCard tests still pass
- [ ] `npm run check:types` clean, `npx jest` green, `npm run lint` clean

---

## Architecture Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Pure utility functions in `lib/` | CA rule: business logic not in components | Small indirection for a tiny helper |
| `lastAccuracy` prop on SheetCard | SheetCard is a dumb UI component; LibraryScreen owns context reads | SheetCard callers must compute it |
| LibraryScreen derives `lastAccuracy` via util | Keeps the screen as the integration point | Adds a `useMemo` to LibraryScreen render |
| OMR badge on regular card only (not compact) | Compact mode is a space-constrained widget | Compact variant stays minimal |

---

## Dependencies

**Confirmed existing files this feature depends on:**
- [x] `client/components/SheetCard.tsx` (154 lines)
- [x] `client/screens/LibraryScreen.tsx` (213 lines)
- [x] `client/context/PracticeContext.tsx` — provides `sessions: PracticeSession[]`
- [x] `client/lib/storage.ts` — defines `SheetMusic` (with `omrStatus`) and `PracticeSession`
- [x] `__tests__/components/SheetCard.test.tsx` — existing test file to extend
- [x] `client/constants/theme.ts` — `Spacing`, `BorderRadius`, `Typography` (pattern from SheetCard)

**New files:**
- `client/lib/practiceCardUtils.ts` — [TO CREATE]
- `__tests__/unit/lib/practiceCardUtils.test.ts` — [TO CREATE]

---

## CA Layer Map

| File | Layer |
|------|-------|
| `client/lib/practiceCardUtils.ts` | Entities (pure TS, no RN, no Supabase) |
| `client/components/SheetCard.tsx` | Frameworks & Drivers (UI) |
| `client/screens/LibraryScreen.tsx` | Frameworks & Drivers (UI) |

---

## Phase Breakdown

---

### Phase 1: Utility Functions
**Layer**: Entities  
**Goal**: Pure TypeScript helpers that derive display values from raw data — no React, no RN imports  
**Status**: Pending

**Files**:
- `client/lib/practiceCardUtils.ts` — [TO CREATE]
- `__tests__/unit/lib/practiceCardUtils.test.ts` — [TO CREATE]

**Interface contract** (what this phase produces for Phase 2):
```ts
import type { PracticeSession } from "@/lib/storage";

/** Returns the most recent session for a given sheet, or undefined. */
export function getLastSession(
  sessions: PracticeSession[],
  sheetId: string
): PracticeSession | undefined

/** Formats a 0–1 accuracy float to a percentage string, e.g. 0.87 → "87%". Returns null for undefined. */
export function formatAccuracy(accuracy: number | undefined): string | null

/** Returns a human-readable label for omrStatus, or null when status is "none". */
export function omrStatusLabel(
  status: SheetMusic["omrStatus"]
): { label: string; variant: "processing" | "ready" | "failed" } | null
```

---

**RED — Write all failing tests first**
- [ ] **Test 1.1**: `getLastSession` returns the latest session by `startTime` for a given sheet
  - File: `__tests__/unit/lib/practiceCardUtils.test.ts` — [TO CREATE]
  - Scenario: two sessions for same sheetId with different startTimes → returns the one with the larger startTime
  - Expected failure: `TypeError: getLastSession is not a function`
  - Fixtures: `sessions = [{ sheetMusicId: "s1", startTime: 1000, accuracy: 0.7, ... }, { sheetMusicId: "s1", startTime: 2000, accuracy: 0.9, ... }]`
- [ ] **Test 1.2**: `getLastSession` returns `undefined` when no sessions match the sheetId
  - Same file
  - Scenario: sessions array has entries for a different sheet → returns undefined
- [ ] **Test 1.3**: `formatAccuracy` converts 0–1 float to "N%" string
  - Same file
  - Scenario: `formatAccuracy(0.87)` → `"87%"`, `formatAccuracy(1)` → `"100%"`, `formatAccuracy(0)` → `"0%"`
- [ ] **Test 1.4**: `formatAccuracy` returns `null` for `undefined` input
  - Same file
  - Scenario: `formatAccuracy(undefined)` → `null`
- [ ] **Test 1.5**: `omrStatusLabel` returns correct label+variant per status
  - Same file
  - Scenario: `"processing"` → `{ label: "Scanning…", variant: "processing" }`, `"ready"` → `{ label: "Ready", variant: "ready" }`, `"failed"` → `{ label: "Failed", variant: "failed" }`
- [ ] **Test 1.6**: `omrStatusLabel` returns `null` for `"none"`
  - Same file
  - Scenario: `omrStatusLabel("none")` → `null`

*Verify all tests FAIL before proceeding to GREEN.*

---

**GREEN — Implement to make tests pass**
- [ ] **Task 1.7**: Implement all three functions in `client/lib/practiceCardUtils.ts`
  - `getLastSession`: filter by sheetId, sort descending by `startTime`, return first
  - `formatAccuracy`: guard on undefined, `Math.round(accuracy * 100) + "%"`
  - `omrStatusLabel`: switch on status, return `null` for `"none"`
  - No React Native imports — pure TypeScript only

---

**REFACTOR — Clean up while tests stay green**
- [ ] Extract status map as a const to avoid repeated switch if desired; keep under 40 lines total

---

**Phase 1 Quality Gate**:
- [ ] `npm run check:types` — zero errors
- [ ] `npx jest __tests__/unit/lib/practiceCardUtils.test.ts` — all 6 tests green
- [ ] `npm run lint` — zero errors
- [ ] `client/lib/practiceCardUtils.ts` has zero imports from RN, hooks, context, screens, or components
- [ ] File is under 50 lines

---

### Phase 2: SheetCard UI + LibraryScreen Wiring
**Layer**: Frameworks & Drivers (UI)  
**Goal**: SheetCard renders OMR badge and accuracy chip; LibraryScreen computes and passes data  
**Status**: Pending

**Files**:
- `client/components/SheetCard.tsx` (154 lines, confirmed)
- `client/screens/LibraryScreen.tsx` (213 lines, confirmed)
- `__tests__/components/SheetCard.test.tsx` (existing, to extend)

**Interface contract** (what this phase produces):
```tsx
// SheetCard gains two optional props:
interface SheetCardProps {
  sheet: SheetMusic;
  onPress: () => void;
  onFavorite?: () => void;
  compact?: boolean;
  lastAccuracy?: number;   // NEW: 0–1 float, shown as "87%"
}

// LibraryScreen wires it:
const lastAccuracy = (sheetId: string) => 
  getLastSession(sessions, sheetId)?.accuracy
```

---

**RED — Write all failing tests first**
- [ ] **Test 2.1**: SheetCard shows OMR `"ready"` badge when `omrStatus === "ready"`
  - File: `__tests__/components/SheetCard.test.tsx` — extend existing file
  - Scenario: `makeSheet({ omrStatus: "ready" })` → `getByTestId("omr-badge")` exists and contains "Ready"
  - Expected failure: `Unable to find an element with testID: omr-badge`
- [ ] **Test 2.2**: SheetCard shows `"processing"` badge
  - Same file
  - Scenario: `makeSheet({ omrStatus: "processing" })` → badge contains "Scanning…"
- [ ] **Test 2.3**: SheetCard shows `"failed"` badge
  - Same file
  - Scenario: `makeSheet({ omrStatus: "failed" })` → badge contains "Failed"
- [ ] **Test 2.4**: SheetCard shows NO badge when `omrStatus === "none"` or omrStatus is missing
  - Same file
  - Scenario: `makeSheet({ omrStatus: "none" })` → `queryByTestId("omr-badge")` is null
- [ ] **Test 2.5**: SheetCard shows accuracy chip when `lastAccuracy` is provided
  - Same file
  - Scenario: `<SheetCard ... lastAccuracy={0.87} />` → `getByTestId("accuracy-chip")` contains "87%"
- [ ] **Test 2.6**: SheetCard shows NO accuracy chip when `lastAccuracy` is undefined
  - Same file
  - Scenario: no `lastAccuracy` prop → `queryByTestId("accuracy-chip")` is null

*Verify all tests FAIL before proceeding to GREEN.*

---

**GREEN — Implement to make tests pass**
- [ ] **Task 2.7**: Add `lastAccuracy?: number` to `SheetCardProps` in `client/components/SheetCard.tsx`
- [ ] **Task 2.8**: In the full-card render branch, add OMR status badge below the image area
  - Use `omrStatusLabel(sheet.omrStatus)` imported from `@/lib/practiceCardUtils`
  - Render a small pill badge with `testID="omr-badge"` only when `omrStatusLabel` returns non-null
  - Color map: `processing` → `colors.warning` (or `colors.accent`), `ready` → `colors.primary`, `failed` → `colors.error`
- [ ] **Task 2.9**: In the `metaRow`, add accuracy chip when `lastAccuracy !== undefined`
  - Use `formatAccuracy(lastAccuracy)` from `@/lib/practiceCardUtils`
  - Render a `<Text testID="accuracy-chip">` beside the folder meta item
- [ ] **Task 2.10**: Update `LibraryScreen.tsx` to import `getLastSession` and pass `lastAccuracy` to each `SheetCard`
  - Destructure `sessions` from `usePractice()`
  - Pass `lastAccuracy={getLastSession(sessions, item.id)?.accuracy}` to each `<SheetCard>`

---

**REFACTOR — Clean up while tests stay green**
- [ ] Ensure OMR badge and accuracy chip styles are added to `StyleSheet.create(...)` (no inline style objects)
- [ ] Confirm SheetCard stays under 250 lines

---

**Phase 2 Quality Gate**:
- [ ] `npm run check:types` — zero errors
- [ ] `npx jest __tests__/components/SheetCard.test.tsx` — all tests green (existing + 6 new)
- [ ] `npx jest` (full suite) — no regressions
- [ ] `npm run lint` — zero errors
- [ ] `SheetCard.tsx` under 250 lines
- [ ] `LibraryScreen.tsx` under 250 lines
- [ ] `SheetCard` imports `practiceCardUtils` from `@/lib/` only (not from screens/context)
- [ ] `LibraryScreen` does NOT call Supabase directly

---

## Global Maintainability Audit (Post All Phases)

Run after both phases complete:
```bash
# Line counts
wc -l client/lib/practiceCardUtils.ts client/components/SheetCard.tsx client/screens/LibraryScreen.tsx

# No `any` types
grep -n ": any" client/lib/practiceCardUtils.ts client/components/SheetCard.tsx client/screens/LibraryScreen.tsx

# Non-null assertions
grep -n "![^=]" client/lib/practiceCardUtils.ts client/components/SheetCard.tsx client/screens/LibraryScreen.tsx | grep -v "//"
```

Then run `sc:analyze` for architectural review.  
Then run `sc:cleanup` for a final code quality pass.
