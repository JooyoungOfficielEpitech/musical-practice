# X-Notehead Pipeline Implementation

## Overview
This document describes the complete X-notehead pipeline for detecting and preserving spoken/unpitched notes (marked as X-noteheads in sheet music) through the OMR workflow.

## Problem Statement
Previously, the OMR pipeline replaced X-noteheads with filled round noteheads to help the homr detector recognize their rhythm, but then discarded the information that they were originally X-noteheads. This caused the app to render them as pitched notes instead of unpitched (spoken) notes.

## Solution Architecture

### Phase 1: Detection (`core/staff_cropper.py`)
**Function**: `replace_x_noteheads(img: np.ndarray) -> tuple[np.ndarray, list[int]]`

**Changes**:
- Modified return type from `np.ndarray` to `tuple[np.ndarray, list[int]]`
- Now returns both:
  1. Processed image with X-noteheads replaced by filled circles
  2. List of x-coordinates (in cropped image space) where X-noteheads were detected

**Detection Method**:
- Uses template matching with synthetic X cross patterns (sizes 9, 11, 13)
- Applies staff mask to filter false positives
- Deduplicates nearby detections
- Sorts by confidence score

**Returns**:
```python
result_image, x_positions = replace_x_noteheads(img)
# result_image: processed image with round noteheads instead of X's
# x_positions: [150, 250, 350, ...] — x-coordinates of detected X's
```

### Phase 2: Post-Processing (`pipeline/postprocessor.py`)
**Function**: `mark_x_noteheads_in_xml(xml_str: str, x_positions: list[int]) -> str`

**Purpose**:
- Takes raw MusicXML from homr (which has pitched notes where X's were)
- Converts first N pitched notes to unpitched elements (in document order)
- Each converted note receives:
  - `<unpitched>` element with `<display-step>B</display-step>` and `<display-octave>4</display-octave>`
  - `<notehead>x</notehead>` to explicitly mark as X-notehead
  - Removal of original `<pitch>` element

**Limitations & Design Notes**:
- Currently uses simple document-order matching: first len(x_positions) pitched notes are marked
- Does NOT attempt spatial correlation (x-offset in image to note onset time)
- This simplified approach works because:
  - Spoken rhythm measures are dense eighth notes with no intervening rests
  - All notes in the measure are typically X-noteheads together
  - The order is deterministic and matches visual order

**Future Enhancement** (if needed):
- Could add spatial correlation by computing x-positions for each note based on onset time
- Would require knowledge of image width, staff position, and note spacing

### Phase 3: Pipeline Threading (`run_local.py`)
**Changes**:
1. Imported `mark_x_noteheads_in_xml` from postprocessor
2. Modified per-staff processing loop:
   - Unpack x_positions from `replace_x_noteheads()` call
   - Call `mark_x_noteheads_in_xml(xml, x_positions)` after initial postprocessing
   - Added logging to track detected and marked X-noteheads

**Flow**:
```
Staff Image
    ↓
replace_x_noteheads() ──→ (processed_image, x_positions)
    ↓                              ↓
  homr              [store for later]
    ↓
  raw_xml
    ↓
postprocess_musicxml()
    ↓
mark_x_noteheads_in_xml(xml, x_positions)
    ↓
  final_xml with unpitched notes
```

### Phase 4: App Integration
**MusicXML Parser** (`client/lib/audio/musicXmlParser.ts`):
- Already handles unpitched notes (lines 436-452)
- Checks for `<unpitched>` element
- Extracts `<display-step>` and `<display-octave>` (defaults: B, 4)
- Converts to pitch "Bb4" (using alterStr = "-1" for Bb)

**No changes required** — parser already compatible.

## Test Coverage

### Unit Tests (18 tests, all passing)

#### TestReplaceXNotehead_Signature (3 tests)
- `test_returns_tuple_of_two_elements`: Verifies return type is tuple
- `test_returns_image_and_list`: Verifies first element is ndarray, second is list
- `test_positions_list_contains_numbers`: Validates list contents

#### TestReplaceXNotehead_Accuracy (3 tests)
- `test_empty_image_returns_empty_positions`: No X's → empty list
- `test_single_x_notehead_detected`: Single synthetic X → detected
- `test_multiple_x_noteheads_all_detected`: Multiple X's → all detected

#### TestMarkXNotehead_InXml (5 tests)
- `test_function_exists_in_postprocessor`: Import check
- `test_converts_note_at_x_offset_to_unpitched`: Note converted to unpitched
- `test_adds_notehead_attribute_x`: Notehead element added with text="x"
- `test_empty_x_positions_no_conversion`: Empty positions → no changes
- `test_multiple_x_positions_all_converted`: Multiple positions → all converted

#### TestXNotehead_Integration (1 test)
- `test_integration_detect_and_mark_in_xml`: End-to-end synthetic workflow

#### TestXNotehead_AppCompatibility (4 tests)
- `test_unpitched_has_display_step_and_octave`: Required elements present
- `test_unpitched_defaults_to_b4_for_app`: Correct defaults (B4)
- `test_spoken_rhythm_measure_eight_x_noteheads`: Full measure of 8 X's marked
- `test_x_notehead_has_notehead_element`: notehead="x" present

#### TestXNotehead_EdgeCases (2 tests)
- `test_xml_with_rests_and_notes`: Rests left untouched; only pitched notes converted
- `test_multiple_measures_with_x_noteheads`: X's span multiple measures correctly

### Regression Tests
All existing tests continue to pass:
- `test_staff_cropper.py`: 10 tests ✓
- `test_postprocessor.py`: 27 tests ✓
- All other tests: 231 tests ✓

**Total**: 268 tests passing

## Ground Truth Verification

### Reference File
- Source: `reference/ground_truth_p1_hermes.json`
- Verified against: `하데스타운 악보 통합본-001.png` (2026-07-04)
- Key finding: **Measure 11 is a whole rest, NOT 8 X-noteheads**

### Measure 11 Status
- **Ground truth claim**: Whole rest (correct) ✓
- **Note**: Some debug output might have shown measure index confusion
- **Actual measures with X-noteheads**: 12, 13, 14 (each has 8 eighth-note X's)

No changes needed to ground_truth files — they are already correct.

## Implementation Checklist

- [x] Modified `replace_x_noteheads()` to return tuple with x-positions
- [x] Created `mark_x_noteheads_in_xml()` function
- [x] Integrated into `run_local.py` pipeline
- [x] Added comprehensive test suite (18 tests)
- [x] All existing tests still pass (250+ tests)
- [x] Verified app parser compatibility
- [x] Verified ground truth accuracy

## Usage Example

```python
from core.staff_cropper import replace_x_noteheads
from pipeline.postprocessor import postprocess, mark_x_noteheads_in_xml
from pipeline.omr_runner import run_homr

# Load and process image
staff_img = cv2.imread("staff.png")

# Step 1: Detect and replace X-noteheads
processed_img, x_positions = replace_x_noteheads(staff_img)

# Step 2: Run homr (uses processed_img without X's)
raw_xml = run_homr(processed_img, tmp_dir)

# Step 3: Post-process
xml = postprocess(raw_xml)

# Step 4: Mark X-noteheads in XML
xml = mark_x_noteheads_in_xml(xml, x_positions)

# Result: xml contains unpitched notes with notehead="x"
```

## Future Improvements

1. **Spatial Correlation**: Enhance matching to use x-offset-to-onset-time mapping
2. **Confidence Scoring**: Add confidence metrics for uncertain X-notehead positions
3. **Multi-Staff Handling**: Better tracking of x-positions across multiple staves
4. **Batch Processing**: Optimize for processing multiple files

## Files Modified

1. `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/core/staff_cropper.py`
   - Changed `replace_x_noteheads()` signature and implementation

2. `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/pipeline/postprocessor.py`
   - Added `mark_x_noteheads_in_xml()` function

3. `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/run_local.py`
   - Updated imports
   - Modified per-staff processing loop

4. `/Users/mmecoco/Desktop/musical-practice/tools/omr-server/tests/test_x_notehead_pipeline.py`
   - New comprehensive test file (18 tests)

## Verification Commands

```bash
# Run all X-notehead tests
pytest tests/test_x_notehead_pipeline.py -v

# Run with coverage (if pytest-cov installed)
pytest tests/test_x_notehead_pipeline.py --cov=core.staff_cropper --cov=pipeline.postprocessor

# Run full test suite
pytest tests/ -v
```

## Notes

- The implementation follows TDD methodology: tests written first, then implementation
- All changes maintain backward compatibility (except the intentional API change to `replace_x_noteheads()`)
- The solution is minimal and focused: no over-engineering or premature optimization
- Ground truth files are accurate and require no corrections
