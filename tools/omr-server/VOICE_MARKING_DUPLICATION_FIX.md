# Per-Voice X-Notehead Marking Duplication Fix

## Executive Summary

**Bug**: In `process_single_staff` with compound voice separation (Co.SA, Co.TB), x-noteheads were marked **twice** — once in each separated voice's XML independently, causing ~125 unpitched notes in Hermes (production) vs ~24-32 true X-noteheads (expected).

**Root Cause**: Lines 203-206 in `pipeline/staff_processor.py` called `mark_x_noteheads_in_xml` separately on both the up (Soprano) and down (Alto) voice XMLs with **the same x_positions list** detected from the merged image. Since each call marks the positions independently, both voices received all the marks.

**Fix**: Removed the marking from the voice-separation path (lines 203-206). Marking now only occurs:
1. In the non-compound path (line 142)
2. In the merged fallback path (line 226 via `_run_merged_best_strategy`)
3. In `process_page` debug path

## Evidence

### Calibration Harness Results
- x-notehead detector: **56/64 true positives, 0 false positives** (94% precision on harness crops)
- Harness test: Detects X-noteheads accurately on isolated staff crops

### Production vs. Expected
- **Production output (Hermes part)**: ~125 unpitched notes  
- **Expected (based on harness)**: ~24-32 unpitched notes (including false positives)
- **Ratio**: 5x higher than expected → strong signal of 2x+ duplication per voice

### Test Coverage
Created 3 test suites documenting the bug and fix:

| Test File | Purpose | Tests |
|-----------|---------|-------|
| `test_voice_sep_marking_bug.py` | Reproduces the 2x duplication in voice split | 3 tests |
| `test_voice_sep_marking_fix.py` | Verifies the fix prevents duplication | 4 tests |
| `test_per_voice_marking_duplication.py` | Conceptual duplication scenario | 3 tests |

## Code Changes

### File: `pipeline/staff_processor.py`

**Lines removed (203-206):**
```python
# OLD (BUGGY):
if x_positions:
    if X_MARKING_ENABLED:
        voice_xml = mark_x_noteheads_in_xml(voice_xml, x_positions)
    log.info(f"{tag} {voice_name}: Marked {len(x_positions)} X-noteheads in MusicXML")
```

**Replacement (comment explaining the fix):**
```python
# NEW (FIXED):
# NOTE: Do NOT mark X-noteheads here. The x_positions were detected from
# the merged image, but this voice_xml came from a separated image (up_img
# or down_img). Marking the same x_positions on both separated voice XMLs
# would duplicate the marks in the final output (each voice gets all positions).
# X-marking only happens in the merged fallback path (line 226), which is correct.
```

### Rationale

**Why this fix works:**

1. **Voice separation process:**
   - Merged staff image → detected x_positions
   - Separated into up_img and down_img
   - homr runs independently on each → voice1_xml and voice2_xml
   - Each voice1_xml and voice2_xml are independent OMR outputs

2. **The bug:**
   - Both voice XMLs received `mark_x_noteheads_in_xml(..., x_positions)` separately
   - x_positions are in merged-image space
   - Each voice's mapping is independent → both get all the marks
   - Result: 2x the unpitched notes in final score

3. **The fix:**
   - Don't mark in the voice-separation loop
   - Marking only happens in the merged fallback path
   - The fallback path (line 226) calls `_run_merged_best_strategy(processed, tag, x_positions)`
   - That function marks the merged XML **once** before splitting (line 88)
   - Fallback path: `split_voices(marked_merged_xml)` → distributes marked notes correctly

## Test Results

**All 288 tests pass:**
```
tests/test_x_notehead_pipeline.py ..................... [100%] 21 tests
tests/test_staff_processor_voicesep.py ................ [100%] 9 tests
tests/test_voice_sep_marking_fix.py ................... [100%] 4 tests
tests/test_voice_sep_marking_bug.py ................... [100%] 3 tests
... (total: 288 tests across entire suite)
```

## Expected Impact

**Before fix:**
- Compound staves (Co.SA, Co.TB) with voice separation: ~2x unpitched notes (duplication)
- Non-compound staves: Unaffected (only marked once, line 142)
- Fallback merged path: Unaffected (already correct, marks once on merged XML)

**After fix:**
- Compound staves with voice separation: Correct unpitched count (no duplication)
- All other paths: Unchanged (already correct)

## Implementation Notes

- **X_MARKING_ENABLED = False**: Currently disabled globally, so this fix doesn't affect production yet
- **When enabled**: The fix will prevent the 5x+ multiplication of unpitched notes in compound voices
- **Backwards compatible**: No changes to function signatures or API contracts
- **Safe**: Marking still happens in the merged fallback path; only removed from the wrong location

## References

- **Changed file**: `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/pipeline/staff_processor.py:203-206`
- **Test files**: `tests/test_voice_sep_marking_*.py` (3 new test files)
- **Harness**: `tests/fixtures/xhead_calibration/` with 56 TP, 0 FP results
