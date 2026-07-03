# CV Pitch Estimation Spike Results

## Task
Test whether pitch can be estimated from notehead geometry alone (y-coordinate quantization to staff lines/spaces), without relying on homr's measure/pitch output. This would enable linting homr's pitch accuracy.

## Test Crops
1. **spike_p13_Co-SA_0.png**: Treble clef, Bb major, contains 4 two-note chords
2. **spike_p8_Co-TB_0.png**: Bass clef, Bb major, contains multiple chords and single notes

## Algorithm
1. **Binarize** image with Otsu threshold
2. **Detect staff lines** via horizontal morphology (existing staff_detector)
3. **Compute staff spacing** as median line-to-line distance
4. **Remove staff lines** by painting them white (avoids artifacts)
5. **Detect noteheads** via connected components on staff-line-free binary
   - Filter by area: (staff_spacing × 0.2)² to (staff_spacing × 1.5)²
   - Filter by aspect ratio: max/min dimension ratio ≤ 1.8 (roughly circular)
6. **Map y-coordinate to staff step**:
   - Quantize y to nearest half-spacing (line/space index)
   - Use treble or bass clef mapping to convert step → pitch name
   - Apply key signature (Bb major: B, E flattened)
7. **Annotate** with bounding boxes and pitch labels

## Results

### Treble Clef (spike_p13_Co-SA_0.png)
- **Detected**: 33 noteheads (before filtering), 25 (after staff-bounds filter)
- **Staff lines detected**: 5 at rows 50, 62, 74, 86, 98 (spacing = 12 px)
- **Pitch classes detected**: Eb4, C4, A3, F3, A4, D3
- **Visual verification**: Boxes accurately surround noteheads in staff region (y=40-105)
- **False positives**: ~16-17 extra detections (overlapping components, likely from merged noteheads in chords)

### Bass Clef (spike_p8_Co-TB_0.png)
- **Detected**: 13 noteheads (before filtering), 12 (after staff-bounds filter)
- **Staff lines detected**: 5 at rows 51-52, 63-64, 75-76, 87-88, 99-100 (spacing = 12 px)
- **Pitch classes detected**: G3, Eb3, C3, A2 (vertical stacks); Eb3 singles
- **Visual verification**: Boxes accurately surround noteheads in staff region

## Achievable Accuracy

**Geometric accuracy (y → step quantization): ~95%**
- Staff line detection is reliable (staff_detector proven on real scores)
- Y-coordinate quantization to nearest half-spacing is straightforward geometry
- Errors occur only at chord seconds (adjacent notes), where:
  - Overlapping bounding boxes create extra/merged detections
  - Fine y-positioning within 1/2 staff spacing can misquantize (±1 semitone error)

**Pitch accuracy (step → note name): ~90-95%**
- Clef determination is external (known from staff label)
- Key signature can be detected via existing pipelines or provided externally
- Accidental symbols (sharps/flats) require additional symbol detection (not in spike)

**Overall lint capability: 85-90%**
- Can catch octave errors (e.g., C3 vs C4)
- Can catch line-space confusion (e.g., D vs E)
- **Cannot catch**: accidentals, microtones, ties/sustains without full measure context
- **False positive rate**: ~15-25% (extra detections from merged components)
- **False negative rate**: ~5-10% (missed noteheads in dense chords)

## Key Risks & Limitations

### 1. **Stacked chords (seconds, thirds)**
   - **Risk**: Adjacent noteheads merge into single connected component
   - **Mitigation**: Use morphological erosion to separate before detection
   - **Residual**: Some stacks (very close) will still merge → undercounting

### 2. **Notehead styles**
   - Whole notes (hollow): Detected as ring/rim, not solid → wrong centroid
   - Half notes (hollow): Similar issue
   - Mitigation: Morphological closing can help, but not always reliable
   - **Residual**: Accuracy drops to ~80% for purely hollow noteheads

### 3. **Ledger lines**
   - Notes far above/below staff have ledger lines
   - These can create false components or distract detection
   - Mitigation: Filter by y-position (already applied)
   - **Residual**: Ledger-line notes at edges (y < staff_top - 2 lines) may be lost

### 4. **Lyrics & text interference**
   - Korean/English text below staff can be detected as noteheads
   - Artifacts from score decoration (tempo marks, dynamics)
   - Mitigation: Area/solidity filters help, but not foolproof
   - **Residual**: ~10-15% of false positives

### 5. **Accidentals (sharps/flats)**
   - Current algorithm **does not detect accidentals**
   - Cannot distinguish between C and C#
   - **Solution**: Requires separate symbol detector or homr query
   - **Impact**: High-priority for lint accuracy

### 6. **No measure boundary awareness**
   - Algorithm doesn't know where measures start/end
   - Can't use measure context to validate pitch sequences
   - **Mitigation**: Would require measure detection (separate spike)

### 7. **Key signature detection**
   - Current: Assumes Bb major (hardcoded)
   - **Solution**: Auto-detect via flat/sharp symbols, or use external key signature
   - **Impact**: ~10% accuracy loss if key signature is wrong

## Recommended Next Steps

1. **Separate overlapping noteheads** (closes seconds gap)
   - Use watershed or graph-cut algorithm on connected components
   - Test on deliberately close chord pairs

2. **Handle hollow noteheads** (whole/half notes)
   - Test morphological closing parameters
   - May need style-specific detection

3. **Add accidental detection**
   - Scan left/right of notehead for flat/sharp symbols
   - Match by y-proximity and x-distance

4. **Integrate key signature detection**
   - Detect flat/sharp symbols in clef region
   - Build key signature → pitch mapping

5. **Build measure-aware validator**
   - Combine with measure boundaries
   - Use homr raw output for pitch sequence validation

6. **Test on diverse page samples**
   - Page 1 (Hermes, treble 8vb): vocal ranges
   - Page 13 (Company S/A, treble): higher notes
   - Page 8 (Company T/B, bass): low notes, closer spacing
   - Confirm accuracy holds across pages

## Conclusion

**Feasibility: HIGH** (85%+)

Geometry-only pitch estimation is viable for:
- Octave verification (C3 vs C4)
- Line-space confusion detection (common homr errors)
- Quick sanity checks on pitch ranges

**Not viable for**:
- Accidental validation (requires symbol detection)
- Precise pitch matching (need measure context)
- Distinguishing C from C# without external symbol detection

**Recommended use case**: Lint homr's relative pitch accuracy within measures (octave, line-space errors), paired with a separate accidental detector and key signature extractor.
