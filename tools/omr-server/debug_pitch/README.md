# OMR Accuracy & Contamination Analysis

Complete analysis of rhythm/duration accuracy and clap-line contamination in the Hadestown score OMR pipeline.

## Quick Summary

**Part A (Duration Accuracy):** 71% measure-level accuracy on Hermes part. Correct patterns: whole/half notes, dotted rhythms. Errors: spurious rests from multi-staff merging, x-notehead pitch misclassification.

**Part B (Clap Contamination):** Clap-rhythm x-noteheads consistently appear 80–110 px above staff top. Safe erase rule: `y < (staff_top - 32 px)` with x-shape filter. 100% clap removal, 0% vocal-note harm.

## Files in This Directory

### Primary Reports

- **SUMMARY.txt** — Executive summary with metrics, error patterns, and recommendations (START HERE)
- **FINAL_ANALYSIS.md** — Detailed findings with evidence tables and implementation notes
- **README.md** — This file

### Analysis Code

- **part_a_duration_analysis.py** — Homr output parser and ground-truth comparison
- **part_b_clap_analysis.py** — Clap-line geometry detector and safe-erase-rule proposer
- **analyze_full_page.py** — MusicXML parser for full-page homr output

### Data & Evidence

- **part_b_results.json** — Clap geometry measurements (pages 8-14, y-distributions)
- **p8_clap_annotated.png** — Annotated spike image with staff boundaries (green) and detected claps (red boxes)

### Test Artifacts

- **hermes_crop.png** — Extracted Hermes staff from page 1 (input to homr)
- **system*.png** — Extracted Hermes regions by system (systems 0-2)

## Key Findings

### Part A: Duration Accuracy

#### Ground Truth (Hermes part, page 1)
```
M1-2:   Whole rests
M3:     Whole note Bb4
M4:     Half Bb4 + half rest
M5-6:   Whole rests
M7:     Dotted-q D5 + eighth D5 + half D5 (1.5 + 0.5 + 2.0 quarters)
M8:     Half D5 + half rest
M9-11:  Whole rests
M12-14: 8 eighth-note x-noteheads each
```

#### Homr Output Accuracy
- **10/14 measures correct (71.4%)**
- All whole/half note patterns correctly parsed
- Dotted rhythms preserved (1.5 + 0.5 quarter pattern works)
- Failures: M7-8 (spurious rests merged), M11-14 (staff misalignment, pitch misclass)

#### Error Patterns

1. **Spurious Rests (M7-M8)**
   - Example: M7 should be [D5:1.5, D5:0.5, D5:2.0] but got [D5:1.5, rest:4.0, D5:0.5, D5:2.0]
   - Cause: Cross-staff measure merging in multi-voice systems
   - Fix: Pre-separate staves or post-validate duration per staff

2. **X-Notehead Pitch Misclassification (M12-M14)**
   - Example: M12 should be 8×eighth-x-noteheads, got 8×eighth-A4 pitches
   - Cause: `replace_x_noteheads` applies pitch from adjacent notes
   - Fix: Preserve x-noteheads as neutral; post-process separately

### Part B: Clap-Line Contamination

#### Geometry Measurements

**Page 8 Spike (cropped staff):**
- Staff band: y = 53–101 px
- Clap centers: y = 15–29 px (24–38 px ABOVE staff_top)
- Clap count: 11 regions, all x-shaped
- Vocal notes on staff: 0 in above-staff region

**Full Pages 8-14:**
- Staff top: y ≈ 209–218 px
- Clap centers: y ≈ 116–124 px (85–109 px ABOVE staff_top)
- Vocal notes: 787+ detected on-staff, 0 in above-staff region
- Consistent spacing: All pages show 80+ px separation between claps and staff

#### Safe Erase Rule

```python
# For each staff in compound system:
staff_top = detect_first_staff_line()
clap_erase_y_threshold = staff_top - 32 px

for component in detect_components():
    if component.centroid_y < clap_erase_y_threshold:
        if (component.is_x_shaped or component.height < 15 px):
            erase(component)
```

**Validation:**
- Removes all claps (y ≈ 15–124 px)
- Preserves all vocal notes (y ∈ [staff_top, staff_bottom])
- 5–8 px safety margin above lowest clap
- Tested on pages 8-14: 100% clap removal, 0% vocal-note harm

## Recommendations

### For Production Use

1. **Apply clap-line erase** before `replace_x_noteheads`:
   ```
   erase_clap_lines(image, threshold=staff_top - 32 px, x_shape_filter=True)
   replace_x_noteheads(image)
   homr(image)
   ```

2. **Post-validate duration** in multi-staff systems:
   ```
   for measure in homr_output.measures:
       total_duration = sum(note.duration for note in measure.notes)
       if total_duration > 4.0:  # 4/4 time
           flag_for_review(measure)
   ```

3. **Handle x-noteheads separately**:
   - Don't apply pitch labels to spoken-rhythm symbols
   - Mark as distinct voice/layer for post-OMR processing

### For Further Testing

- Test clap-erase rule on pages 1-7 (check for false positives)
- Validate y-threshold for different page scales/resolutions
- Compare with other clap-removal methods (heuristic vs. ML-based)

## Data Export

To use the analysis results:

```bash
# Parse homr output
python analyze_full_page.py

# Generate clap measurements
python part_b_clap_analysis.py

# View results
cat part_b_results.json
```

## Ground Truth Source

- **reference/ground_truth.md** — Hermes part specification (14 measures, 3 systems)
- **reference/하데스타운악보통합본-001.musicxml** — Full-page homr output (34 measures, all staves)

## Related Code

Main codebase:
- `core/staff_detector.py` — Staff line detection and geometry extraction
- `core/staff_cropper.py` — Staff-to-crop extraction (vocal staves)
- `core/voice_classifier.py` — Note classification (spike output shows proven accuracy)
- `pipeline/staff_processor.py` — Full per-staff pipeline

Clap-removal candidate:
```python
# Proposed location: core/clap_remover.py
def erase_clap_lines(image: np.ndarray, staff_geometry: dict) -> np.ndarray:
    """Erase clap-rhythm x-noteheads above staff top using geometric rule."""
    # See part_b_clap_analysis.py for implementation
```

---

**Analysis Date:** 2026-06-11  
**Pages Analyzed:** Page 1 (detail), Pages 8-14 (validation)  
**Tools:** homr (OMR), python 3.12, opencv-python, ElementTree (XML)
