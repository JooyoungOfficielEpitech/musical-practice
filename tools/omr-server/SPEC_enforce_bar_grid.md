# Implementation Specification: enforce_bar_grid Fix

## Problem Summary

Cross-part temporal drift in multi-character vocal scores occurs because:
1. **align_and_flatten** synchronizes measure COUNT per system (pads short parts with rest measures).
2. **normalize_divisions** unifies all durations to one canonical divisions value.
3. **BUT**: Neither stage ensures every measure of every part sums to EXACTLY the time-signature bar length.

When any measure's note durations sum to fewer or more beats than the time signature declares (e.g., 3.5 beats in a 4/4 measure), the parser's per-part cumulative beat tracking causes downstream parts to drift permanently out of sync.

**Evidence**: 48/127 measures (37.8%) in user_job_result.musicxml and 106/214 (49.5%) in road_to_hell_full14.musicxml have cross-part beat mismatches.

**Fix Invariant**: Force EVERY measure to sum to EXACTLY bar_beats (read from time signature, default 4). This makes every part have identical cumulative beats at every barline → drift becomes mathematically impossible.

---

## 1. New Module: enforce_bar_grid

**File**: `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/pipeline/measure_grid.py`

### Public Function Signature

```python
def enforce_bar_grid(
    char_measures: dict[str, list[ET.Element]],
    bar_beats: float | None = None,
    policy: str = "scale-compress",
    skip_anacrusis: bool = True,
    skip_fermata: bool = True,
) -> dict[str, list[ET.Element]]:
    """
    Force every measure to sum to exactly the bar length in beats.
    
    This function corrects rhythm OCR errors and notation overflow by ensuring
    each measure (across all parts) sums to the time-signature bar length. This
    eliminates cross-part temporal drift caused by measures with mismatched beat totals.
    
    Args:
        char_measures: {part_name: [measure ET.Element]}.
            Measures MUST already be normalized via normalize_divisions (all parts
            share one canonical divisions value). Input is NOT mutated; all measures
            are deep-copied before modification.
        
        bar_beats: Target beat count per measure (e.g., 4.0 for 4/4, 3.0 for 3/4).
            Defaults to None, meaning read from each measure's <time> signature block:
            - Extract <time><beats> and <time><beat-type>
            - Compute bar_beats = (beats * 4) / beat_type
            - If no <time> found, inherit from previous measure
            - If no <time> in entire score, default to 4.0
            
            To override with a fixed bar_beats, pass e.g., bar_beats=4.0.
        
        policy: "scale-compress" | "pad-rest" | "trim" (default: "scale-compress")
            - "scale-compress" (PREFERRED): For measures > bar_beats, rescale all
              non-chord note durations proportionally by (bar_beats / actual_sum).
              This preserves measure count and musical content. Used for overflow
              (OMR doubling, multi-system notes, Hermes melisma post-normalization).
            
            - "pad-rest" (SHORT BARS ONLY): For measures < bar_beats, append a
              <note><rest> with duration = deficit to reach bar_beats. Silently
              extends short measures (OMR rhythm errors, dropped notes).
              
            - "trim" (NEVER USED): Truncate oversized measures by dropping trailing
              notes. Loses musical content; reserved for validation only.
        
        skip_anacrusis: If True (default), detect anacrusis/pickup measures
            (measure 1 where ALL parts sum to < bar_beats uniformly) and SKIP
            bar-grid enforcement for that measure only. Anacrusis measures keep
            their original duration; the parser handles the beat offset correctly.
        
        skip_fermata: If True (default), detect fermata or unpitched note measures
            (where measure contains <fermata> or all notes are <unpitched>) and
            SKIP bar-grid enforcement. These measures carry explicit musical intent
            that cannot be corrected via duration alone. Log a warning for such
            measures.
    
    Returns:
        {part_name: [enforced_measure_elements]} — new dict with deep-copied,
        modified measures. Original input is not mutated.
    
    Raises:
        ValueError: If char_measures is empty or if no canonical divisions can
            be determined (should not occur post-normalize_divisions).
    
    Notes:
        - MUST be called AFTER normalize_divisions, when all parts share one
          canonical divisions. Running before normalize_divisions will produce
          incorrect results due to per-measure divisions changes.
        
        - Measure 1 MUST contain <attributes> with <divisions>. If missing, this
          function adds it (but normalize_divisions should have done this already).
        
        - For tuplets: Does NOT validate tuplet consistency (that is upstream work).
          Simply sums durations as-is. If a tuplet is malformed, it will appear
          as an overflow/underflow and be subject to the enforcement policy.
        
        - For repeats and endings: Assumes input has no repeats (postprocessor.strip_repeats
          removes them before this stage). If repeats exist, they are treated as
          ordinary measures.
    """
```

---

## 2. Bar-Length Determination (Exact Algorithm)

### Read Time Signature Per-Measure (Sticky Inheritance)

```python
def _get_bar_beats_for_score(
    measures: list[ET.Element],
) -> list[float]:
    """
    Return the target beat count for each measure.
    
    - Read <time><beats> and <time><beat-type> from each measure's <attributes>
    - Time signature is "sticky": if measure N has no <time>, inherit from N-1
    - If no <time> found anywhere, default all measures to 4.0
    - Compute bar_beats = (beats * 4) / beat_type
    
    Returns: [bar_beats_for_measure_0, bar_beats_for_measure_1, ...]
    """
```

### Insertion Point in Code

Time signature lookup happens **per-character, per-measure** inside the main loop. Store in local state:

```python
current_bar_beats = 4.0  # default
for measure_idx, measure in enumerate(measures):
    attrs = measure.find("attributes")
    if attrs is not None:
        time_elem = attrs.find("time")
        if time_elem is not None:
            beats = int(time_elem.find("beats").text)
            beat_type = int(time_elem.find("beat-type").text)
            current_bar_beats = (beats * 4) / beat_type
    
    # current_bar_beats is now valid for this measure
    # Apply enforcement with current_bar_beats
```

---

## 3. Overflow Policy (Definitive Choice)

### Default: scale-compress

**Rationale** (from data + image angles):
- **Short bars** (< bar_beats): Use **pad-rest**. OMR rhythm errors (dropped notes, misread durations) produce underflows. Padding with silence is musically acceptable and preserves measure count.
- **Long bars** (> bar_beats): Use **scale-compress**. After divisions normalization, overflow is caused by:
  1. OMR doubling (e.g., ensemble parts with 8.0 beats when expecting 4.0)
  2. Hermes melisma with many unpitched eighths (pre-normalization; post-normalization they should be 4.0)
  3. Multi-system notes incorrectly tagged as one measure
  
  **scale-compress** preserves ALL musical content:
  - Every note/rest stays in the score (no dropped measures or unnatural silence gaps)
  - Relative pitch order is preserved (notes don't reorder, beaming/slurs stay valid)
  - Articulation and dynamic markings stay relative to their notes
  - Lyrical/text alignments in ensemble parts survive
  - Measure count is invariant (required for cross-part alignment)
  
  **Why not pad/trim**:
  - Padding a 16-beat measure to 4 beats with silence would remove 75% of the music.
  - Trimming drops trailing notes and breaks phrase structure.
  - Both destroy user expectations ("I can see the notes in the XML but they're missing in playback").
  
  **Why not halve/rescale naively**:
  - Generic rescaling by 2x or 0.5x is arbitrary; scale-compress ties rescaling to the actual overflow ratio.
  - Integer rounding at target_divisions (24) keeps error < 1 unit.

### Implementation Detail: Integer Scaling

To avoid float rounding errors:
1. Read canonical divisions (from first measure's <divisions> after normalize_divisions).
2. Target divisions = 24 (LCM(2,3,4,6,8,12) — covers most time signatures and tuplets).
3. For each note duration: `new_duration = round(old_duration * target_divisions / canonical_divisions * bar_beats_expected / bar_beats_actual)`
4. Verify result sums to `canonical_divisions * bar_beats_expected` exactly.

---

## 4. Short-Measure Padding Policy

### Create Trailing Rest Element

For any measure where `actual_beats < bar_beats`:

```python
def _create_rest_element(
    deficit_duration: int,
    voice: str = "1",
) -> ET.Element:
    """
    Create a <note><rest> element to pad a short measure.
    
    Args:
        deficit_duration: Duration units needed to reach bar_beats.
            Computed as: deficit_beats * canonical_divisions
        voice: Voice number (default "1").
    
    Returns: <note> element with <rest>, <duration>, <voice>.
    """
    note = ET.Element("note")
    ET.SubElement(note, "rest")
    dur = ET.SubElement(note, "duration")
    dur.text = str(deficit_duration)
    ET.SubElement(note, "voice").text = voice
    ET.SubElement(note, "type").text = "whole"
    return note
```

**Position**: Append to the end of the measure (after any existing <note>, <backup>, <forward>, but before <direction>, <sound>, etc. so it doesn't break parser order expectations).

---

## 5. Edge Case Handling

### (a) Anacrusis / Pickup Measures

**Detection**: Measure 1 where ALL parts sum to the same duration that is < bar_beats.

**Handling**:
```python
if skip_anacrusis and measure_idx == 0:
    # Check if all known characters have the same short duration
    char_durations = {char: measure_beats(parts[0], divisions) 
                      for char, parts in char_measures.items()}
    unique_durations = set(char_durations.values())
    
    if (len(unique_durations) == 1 and 
        list(unique_durations)[0] < bar_beats):
        logger.warning(
            f"Anacrusis detected in measure 1: all parts = "
            f"{list(unique_durations)[0]} beats (< {bar_beats}). "
            f"Skipping bar-grid enforcement for measure 1."
        )
        continue  # Skip enforcement for this measure
```

**Rationale**: An anacrusis must be shorter by design. Forcing it to bar_beats would desynchronize the entire score's beat grid from the actual composition. The parser's per-part cumulative beat model handles anacrusis correctly as long as the offset is consistent across parts (which align_and_flatten guarantees).

---

### (b) Fermata / Intentionally Extended Notes

**Detection**: Measure contains `<fermata>` or is all unpitched notes (spoken rhythm).

**Handling**:
```python
def _has_fermata(measure: ET.Element) -> bool:
    return measure.find(".//fermata") is not None

def _is_all_unpitched(measure: ET.Element) -> bool:
    notes = measure.findall("note")
    if not notes:
        return False
    unpitched = sum(1 for n in notes if n.find("unpitched") is not None)
    return unpitched == len(notes)

if skip_fermata:
    if _has_fermata(measure) or _is_all_unpitched(measure):
        logger.warning(
            f"Fermata/unpitched measure at {measure.get('number')}: "
            f"skipping bar-grid enforcement. Measure duration = "
            f"{measure_beats(measure, divisions):.2f} beats."
        )
        continue  # Skip enforcement
```

**Rationale**: Fermata and spoken narration (all unpitched) are intentional musical markup. The composer/transcriber marked these measures to hold or speak. Truncating or rescaling would destroy the musical intent. Accept the temporal drift that follows (it will be small and localized to these few measures).

---

### (c) Tuplets / Fractional Beat Subdivision

**Validation** (upstream, but document for safety):
- Before enforce_bar_grid, the postprocessor must validate tuplets (already done in pipeline/postprocessor.py: tie_reconstructor).
- Each `<tuplet actual='N' normal='M'>` must have consistent duration across all notes tagged with that tuplet.
- If invalid, tie_reconstructor logs and skips; enforce_bar_grid treats the measure as-is.

**In enforce_bar_grid**: Sum all durations as-is. If a tuplet is malformed, it will show up as overflow/underflow and be subject to the policy. Log if rounding error exceeds 1 duration unit.

```python
# After rescaling, verify result
expected_duration_units = int(bar_beats * canonical_divisions)
actual_duration_units = sum_of_scaled_durations
if abs(actual_duration_units - expected_duration_units) > 1:
    logger.warning(
        f"Measure {measure.get('number')} part {part_name}: "
        f"rounding error after rescale: expected {expected_duration_units}, "
        f"got {actual_duration_units} (delta {actual_duration_units - expected_duration_units})"
    )
```

---

### (d) First Measure <attributes> Block

**Critical**: Never remove, reorder, or strip <attributes> from measure 1.

**In enforce_bar_grid**:
```python
if measure_idx == 0:
    attrs = measure.find("attributes")
    if attrs is None:
        # Should not happen post-normalize_divisions, but add for safety
        attrs = ET.Element("attributes")
        measure.insert(0, attrs)
    # Preserve attrs; only modify note durations
    # attrs remains first child of measure
    
    # If no <divisions> in attrs, normalize_divisions should have added it
    divs_elem = attrs.find("divisions")
    if divs_elem is None:
        logger.error("measure 1 missing <divisions> — should not occur")
```

---

### (e) Repeat Barlines & First/Second Endings

**Current Status**: postprocessor.strip_repeats removes all repeat markup before this stage. No repeats or endings exist in the input to enforce_bar_grid.

**Future Handling** (if repeats are re-enabled):
- Call enforce_bar_grid BEFORE expandRepeats transformation.
- This ensures repeat duplicates inherit already-corrected durations.
- First/second endings with different note counts: reject with clear error message (not yet supported).

---

### (f) Backup/Forward Elements (Multi-voice)

**Current Status**: postprocessor removes all `<backup>` and `<forward>` before this stage. Input to enforce_bar_grid has no multi-voice markup.

**In enforce_bar_grid**, include backup/forward in beat sum for safety:
```python
def measure_beats(measure: ET.Element, divisions: int) -> float:
    total = 0
    for tag in ("note", "backup", "forward"):
        for el in measure.findall(tag):
            dur = el.find("duration")
            if dur is not None:
                # Check if note has <chord> (skip duration)
                if tag == "note" and el.find("chord") is not None:
                    continue
                total += int(dur.text)
    return total / divisions if divisions > 0 else 0.0
```

---

### (g) Chord Notes (Skip Duration)

**Handling**:
```python
for note in measure.findall("note"):
    if note.find("chord") is not None:
        # Chord note: duration belongs to previous non-chord note, skip
        continue
    dur = note.find("duration")
    if dur is not None:
        total += int(dur.text)
```

---

### (h) Unpitched/Spoken Rhythm Measures

**Detection**: All notes in measure are `<unpitched>` (Hermes narration).

**Handling**:
```python
def _is_all_unpitched(measure: ET.Element) -> bool:
    notes = measure.findall("note")
    if not notes:
        return False
    unpitched = sum(1 for n in notes if n.find("unpitched") is not None)
    return unpitched == len(notes)

if _is_all_unpitched(measure):
    # These measures are pre-normalized by postprocessor
    # They already sum to exactly bar_beats (8 eighths = 4 beats at divs=2)
    # Do not mutate further
    logger.debug(
        f"Measure {measure.get('number')}: all unpitched (spoken), "
        f"skipping enforcement (already normalized by postprocessor)."
    )
    continue
```

---

### (i) Empty Measures / Rest-Only Padding

**Detection**: Measure has exactly one `<note><rest>` and no other content.

**Handling**:
```python
def _is_rest_measure(measure: ET.Element) -> bool:
    children = list(measure)
    # Count non-direction, non-sound elements
    timed = [el for el in children if el.tag in ("note", "backup", "forward")]
    return (len(timed) == 1 and 
            timed[0].tag == "note" and 
            timed[0].find("rest") is not None)

if _is_rest_measure(measure):
    # Verify duration = canonical_divisions * bar_beats
    rest_note = measure.find(".//note[rest]")
    dur = rest_note.find("duration")
    expected = int(bar_beats * canonical_divisions)
    if int(dur.text) == expected:
        logger.debug(
            f"Measure {measure.get('number')}: rest measure, "
            f"duration already correct ({dur.text}), skipping."
        )
        continue
    else:
        logger.warning(
            f"Measure {measure.get('number')}: rest measure has duration "
            f"{dur.text}, expected {expected}. Correcting..."
        )
        dur.text = str(expected)
```

---

### (j) Time Signatures Other Than 4/4 (Future)

**Handling** (already covered in section 2):
- Read `<time><beats>` and `<time><beat-type>` per measure.
- For 3/4: bar_beats = 3.0
- For 6/8: bar_beats = 3.0 (if beat = dotted-quarter) or 6.0 (if beat = eighth)
- For 5/4: bar_beats = 5.0
- Default: 4.0

**Validation** (in code):
```python
def _beats_to_beat_type_valid(beats: int, beat_type: int) -> bool:
    # Common: 4/4, 3/4, 2/4, 6/8, 5/4, 9/8, etc.
    return beat_type in (1, 2, 4, 8, 16) and beats > 0

if not _beats_to_beat_type_valid(beats, beat_type):
    logger.warning(
        f"Unusual time signature: {beats}/{beat_type}. Treating as "
        f"{beats} beats of type {beat_type}."
    )
```

---

### (k) Duration Adjustment: Rescale vs Pad vs Trim

**Summary**:
| Condition | Policy | Action |
|-----------|--------|--------|
| measure_beats < bar_beats | pad-rest | Append `<note><rest>` for the deficit. |
| measure_beats == bar_beats | (none) | No change; measure is correct. |
| measure_beats > bar_beats | scale-compress | Rescale all note durations by (bar_beats / actual). |
| Fermata or unpitched | (skip) | Log warning; do not modify. Accept drift. |

---

### (l) Interaction with normalize_divisions

**Critical Order**: enforce_bar_grid MUST run AFTER normalize_divisions.

**Why**:
- After normalize_divisions: All parts share one canonical `divisions` value (LCM).
- bar_beats is defined as quarter-note beats, which is independent of divisions.
- Rescaling formula: `new_duration = old_duration * (bar_beats_expected / bar_beats_actual)`
- This is only correct when both old and new durations are measured in the same divisions scale.

**Insertion in vocal_pipeline.py (line ~143-144)**:
```python
char_flat = normalize_divisions(char_flat)
char_flat = enforce_bar_grid(char_flat)  # <-- INSERT HERE
return combine_chars_to_xml_string(char_flat, title=title)
```

**Insertion in run_local.py (line ~144-145)**:
```python
char_flat = normalize_divisions(char_flat)
char_flat = enforce_bar_grid(char_flat)  # <-- INSERT HERE
combined_xml = combine_chars_to_xml_string(char_flat, title=title)
```

---

## 6. Exact Insertion Points

### vocal_pipeline.py

**Location**: Line 143-144, in `run_vocal_score_pipeline()`

**Before**:
```python
    char_flat = normalize_divisions(char_flat)

    return combine_chars_to_xml_string(char_flat, title=title)
```

**After**:
```python
    char_flat = normalize_divisions(char_flat)
    char_flat = enforce_bar_grid(char_flat)

    return combine_chars_to_xml_string(char_flat, title=title)
```

---

### run_local.py

**Location**: Line 144-145, in `run()`

**Before**:
```python
        char_flat = normalize_divisions(char_flat)
        print(f"      Characters in output: {list(char_flat.keys())}")
        combined_xml = combine_chars_to_xml_string(char_flat, title=title)
```

**After**:
```python
        char_flat = normalize_divisions(char_flat)
        char_flat = enforce_bar_grid(char_flat)
        print(f"      Characters in output: {list(char_flat.keys())}")
        combined_xml = combine_chars_to_xml_string(char_flat, title=title)
```

---

## 7. TDD Test Suite

**File**: `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/tests/test_measure_grid.py`

### Test List

#### Core Functionality

1. **test_uniform_measures_no_change**
   - Input: All measures already sum to bar_beats exactly.
   - Expected: Measures unchanged (no-op).
   - Validates: Idempotence.

2. **test_short_measure_padded_with_rest**
   - Input: One measure sums to 3.0 beats (missing quarter note).
   - Expected: Trailing `<note><rest><duration>` added with duration = 1 (at divs=4).
   - Validates: Pad-rest policy for underflow.

3. **test_multiple_short_measures_each_padded**
   - Input: Three measures, each 3.0 beats (missing quarter each).
   - Expected: Each gets a rest note; all are now 4.0 beats.
   - Validates: Policy applied per-measure, not globally.

4. **test_long_measure_rescaled**
   - Input: One measure = 8.0 beats (double), canonical_divisions = 4.
   - Expected: All note durations halved; measure now 4.0 beats.
   - Validates: Scale-compress policy for overflow.

5. **test_long_measure_scale_compress_preserves_note_count**
   - Input: 8 quarter notes = 8 beats, expecting 4 beats.
   - Expected: 8 notes still present, durations each halved (4 → 2 units).
   - Validates: No notes dropped, only rescaled.

6. **test_ensemble_double_beat_issue**
   - Input: Simulates user_job_result measures 89-94: ensemble = 8.0 beats, Hermes = 4.0 beats.
   - Expected: After enforce_bar_grid, all parts = 4.0 beats.
   - Validates: Fixes the "ensemble=8 vs Hermes=4" issue from context.

#### Bar-Length Determination

7. **test_read_time_signature_4_4**
   - Input: Measure with `<attributes><time><beats>4</beats><beat-type>4</beat-type>`.
   - Expected: bar_beats = 4.0.
   - Validates: Simple 4/4 detection.

8. **test_read_time_signature_3_4**
   - Input: Measure with `<attributes><time><beats>3</beats><beat-type>4</beat-type>`.
   - Expected: bar_beats = 3.0.
   - Validates: 3/4 detection.

9. **test_read_time_signature_6_8**
   - Input: Measure with `<attributes><time><beats>6</beats><beat-type>8</beat-type>`.
   - Expected: bar_beats = 3.0 (6 eighth-note beats = 3 quarter-note beats).
   - Validates: Compound meter conversion.

10. **test_time_signature_sticky_inheritance**
    - Input: Measure 1 declares `<time>4/4</time>`, measure 2 has no `<time>`.
    - Expected: Measure 2 uses bar_beats = 4.0 (inherited).
    - Validates: Sticky time signature.

11. **test_time_signature_change_mid_score**
    - Input: Measure 1-2 = 4/4 (bar_beats = 4.0), measure 3 = 3/4 (bar_beats = 3.0).
    - Expected: Measure 1-2 enforced to 4.0, measure 3 enforced to 3.0.
    - Validates: Per-measure bar_beats tracking.

12. **test_default_bar_beats_when_no_time_signature**
    - Input: Score with no `<time>` elements anywhere.
    - Expected: All measures use bar_beats = 4.0 (default).
    - Validates: Fallback to 4/4.

#### Edge Cases

13. **test_anacrusis_measure_skipped**
    - Input: Measure 1 where ALL parts sum to 2.0 beats (pickup).
    - Expected: Measure 1 unchanged (skipped). Measure 2+ enforced to 4.0.
    - Validates: Anacrusis detection and skip.

14. **test_anacrusis_not_skipped_if_parts_differ**
    - Input: Measure 1 where Hermes = 2.0 beats but Soprano = 4.0 beats.
    - Expected: Measure 1 IS enforced (not anacrusis, parts mismatch). Hermes padded to 4.0.
    - Validates: Anacrusis detection is strict (all parts same short duration).

15. **test_fermata_measure_skipped**
    - Input: Measure with `<fermata>` and duration = 8.0 beats.
    - Expected: Measure unchanged (skipped). Warning logged.
    - Validates: Fermata skip policy.

16. **test_all_unpitched_measure_skipped**
    - Input: Measure with 8 unpitched notes (Hermes narration) summing to 4.0 beats.
    - Expected: Measure unchanged (skipped, already correct).
    - Validates: Unpitched detection.

17. **test_rest_only_measure_duration_verified**
    - Input: Rest-only measure with duration = 2 (should be 4).
    - Expected: Duration corrected to 4.
    - Validates: Rest measure validation.

18. **test_chord_notes_not_counted_in_beat_sum**
    - Input: Measure with 1 regular note (duration=4) + 1 chord note (duration=4).
    - Expected: Measure beat = 4.0 (chord duration ignored). No padding.
    - Validates: Chord handling (no double-counting).

19. **test_backup_forward_included_in_beat_sum**
    - Input: Measure with 2 quarter notes (duration=2 each) + 1 backup + 1 forward (duration=1 each).
    - Expected: Total = 6 duration units = 3.0 beats (at divs=2). Padded to 4.0.
    - Validates: Backup/forward inclusion.

20. **test_measure_one_attributes_preserved**
    - Input: Measure 1 with `<attributes><divisions>4</divisions>...<time>4/4</time>...`.
    - Expected: Attributes intact after enforce_bar_grid, still first child of measure.
    - Validates: Critical measure 1 safety.

#### Cross-Part Invariant (Main Regression Test)

21. **test_user_job_result_musicxml_regression**
    - Input: `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_integration/user_job_result.musicxml`
    - Expected: After normalize_divisions + enforce_bar_grid:
      - 0 cross-part beat mismatches (down from 48).
      - Every measure of every part sums to exactly 4.0 beats.
      - All 127 measures in sync at barlines.
    - Validates: Real-world fix on stale debug file (Jun 12).
    - **Concrete Assertion**:
      ```python
      assert count_mismatched_measures(result) == 0
      assert all_measures_sum_to_bar_beats(result, bar_beats=4.0)
      ```

22. **test_road_to_hell_full14_musicxml_regression**
    - Input: `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_integration/road_to_hell_full14.musicxml`
    - Expected: After normalize_divisions + enforce_bar_grid:
      - 0 cross-part beat mismatches (down from 106).
      - Every measure of every part sums to exactly 4.0 beats.
      - All 214 measures in sync at barlines.
    - Validates: Real-world fix on stale debug file (Jun 11).
    - **Concrete Assertion**:
      ```python
      assert count_mismatched_measures(result) == 0
      assert all_measures_sum_to_bar_beats(result, bar_beats=4.0)
      ```

#### Integration

23. **test_after_normalize_divisions_enforces_correctly**
    - Input: Score with mixed divisions (2, 3, 4), mixed measure lengths.
    - Process: normalize_divisions → enforce_bar_grid.
    - Expected: All measures 4.0 beats post-enforce, divisions unchanged.
    - Validates: Correct ordering and interaction.

24. **test_multiple_parts_stay_synchronized**
    - Input: 5 parts (Hermes, Soprano, Alto, Tenor, Bass), each with random beat sums.
    - Expected: After enforce_bar_grid, every part has identical cumulative beat at every barline.
    - Validates: Cross-part lock invariant.

#### Rounding & Precision

25. **test_integer_duration_no_float_loss**
    - Input: Long measure with 13 beats, expecting 4 beats. Divisions = 24.
    - Expected: Rescale factor = 4/13. New durations all integers (no .5 or .333...).
    - Validates: Integer rounding at target_divisions.

26. **test_rounding_error_logged_when_delta_exceeds_1**
    - Input: Measure with tuplet quantization issue, rescale leaves ±2 units error.
    - Expected: Warning logged. Measure accepted with error note.
    - Validates: Graceful degradation and visibility.

---

### Test Fixtures & Helpers

```python
def _measure(
    number: int,
    divisions: int | None = None,
    durations: list[int] | None = None,
    has_fermata: bool = False,
    has_chord: bool = False,
    time_sig: tuple[int, int] | None = None,
) -> ET.Element:
    """
    Build a test <measure> element.
    
    Args:
        number: Measure number.
        divisions: Value to put in <attributes><divisions>. None = omit.
        durations: List of note durations. None = empty measure.
        has_fermata: Add <fermata/> to measure.
        has_chord: If True, second note is a <chord> note (duration ignored).
        time_sig: (beats, beat-type) to put in <attributes><time>. None = omit.
    """

def count_mismatched_measures(char_measures: dict[str, list[ET.Element]]) -> int:
    """Count measures where at least two parts have different beat sums."""

def all_measures_sum_to_bar_beats(
    char_measures: dict[str, list[ET.Element]],
    bar_beats: float = 4.0,
    tolerance: float = 0.01,
) -> bool:
    """True if every measure of every part sums to bar_beats (within tolerance)."""

def load_musicxml_file(path: str) -> dict[str, list[ET.Element]]:
    """Parse a MusicXML file into {part_id: [measures]}."""
```

---

## 8. Residual Risks & Verification

### Risk 1: Rounding Error Accumulation

**Scenario**: Rescaling a 13-beat measure to 4 beats with divisions=24.
- Factor = 4/13 ≈ 0.3077
- Each note duration multiplied by this factor, then rounded to nearest integer.
- Rounding errors can accumulate, leaving measure ±1-2 units short/long.

**Mitigation**:
- Use target_divisions = 24 (covers most tuplets).
- After rescaling, verify `|actual - expected| <= 1 unit`.
- Log warning if delta > 1.
- Accept small rounding errors (they are < 0.04 beats, imperceptible).

### Risk 2: Overflow in Hermes Melisma (Post-Jun 14 Normalization)

**Scenario**: Current debug files (Jun 11-12) pre-date divisions_normalizer. Stale data shows Hermes measures with 16-30 beats per measure.

**Verification**: Run enforce_bar_grid on a fresh single-page homr output (NEW, not from debug_integration):
1. Process one page of Hadestown score through the current pipeline (June 15+).
2. After normalize_divisions, check Hermes measures for overflow.
3. If post-normalization Hermes is already 4.0 beats per measure, melisma overflow is resolved by normalization.
4. If overflow persists, scale-compress will handle it correctly.

**Action**: Do this verification AFTER implementation, before deploying to production.

### Risk 3: Silent Correctness (No Visible Feedback)

**Scenario**: enforce_bar_grid modifies durations silently. If a user inspects the MusicXML, they see rescaled notes with new durations but no explanation.

**Mitigation**:
- Log every measure that is modified: `logger.info(f"Measure {num} part {part_name}: rescaled from {actual} to {expected} beats")`
- Include log level config in run_local.py to show INFO logs by default.
- Test output should print summary: "Enforced bar-grid: X short measures padded, Y long measures rescaled, Z unchanged."

### Risk 4: Anacrusis Detection False Positive

**Scenario**: Measure 1 where all parts happen to be short (e.g., 3.0 beats) due to OMR error, not compositional intent.

**Mitigation**:
- Log anacrusis detection prominently: `logger.warning(f"Anacrusis detected in measure 1: all parts = {beats} beats. Skipping enforcement.")`
- Document this in the code: "If composer transcribed with an anacrusis, this is correct. If not, manual correction needed."
- The parser will still work (anacrusis produces a beat offset, but per-part alignment is preserved).

### Risk 5: First Measure Attributes Removed or Reordered

**Scenario**: If enforce_bar_grid accidentally strips `<attributes>` from measure 1, the entire file loses divisions/key/time/clef context.

**Mitigation**:
- NEVER remove `<attributes>` from measure 1. Only modify note durations.
- Add assertion: `assert measure[0].tag == "attributes"` after enforce_bar_grid processes measure 1.
- Test case 20 validates this.

---

## Final Implementation Checklist

- [ ] Create `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/pipeline/measure_grid.py` with enforce_bar_grid function.
- [ ] Import enforce_bar_grid in vocal_pipeline.py and run_local.py.
- [ ] Insert function call after normalize_divisions in both files.
- [ ] Create `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/tests/test_measure_grid.py` with 26 test cases.
- [ ] Run `pytest tests/test_measure_grid.py -v` — all tests pass.
- [ ] Run regression tests on user_job_result.musicxml and road_to_hell_full14.musicxml — 0 mismatches.
- [ ] Run `pytest tests/` (full suite) — no regressions.
- [ ] Process a fresh single-page homr run (NEW data) and verify Hermes melisma is within 4.0 beats.
- [ ] Code review (focus: edge case handling, integer rounding, measure 1 attributes preservation).

---

## Summary

**enforce_bar_grid** forces every measure to exactly match the time-signature bar length by:
1. Reading time signature per-measure (sticky inheritance, default 4/4).
2. Computing actual beat sum (non-chord notes only).
3. Comparing to bar_beats.
4. **Short measures**: Padding with a trailing rest.
5. **Long measures**: Scale-compressing all note durations proportionally.
6. **Fermata/anacrusis/unpitched**: Skipping enforcement (accept drift).

This makes cross-part temporal sync an algebraic invariant: all parts have identical cumulative beats at every barline, eliminating drift mathematically.

**Insertion**: After normalize_divisions in both vocal_pipeline.py and run_local.py.

**Tests**: 26 cases covering core functionality, bar-length determination, all edge cases, and two regression tests on real debug files.
