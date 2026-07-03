# Hypothesis Gate Results: FAILED

**Hypothesis**: homr WILL read an erase-from-original image (original grayscale, one voice white-filled, staff lines intact).

## Testing Summary

Tested on 2 crops (spike_p8_Co-TB_0, spike_p13_Co-SA_0) with 6 variants each:

1. **base**: Original grayscale, opposite voice white-filled, staff lines preserved
2. **blur5**: Base + Gaussian blur (5x5, sigma=1.0)
3. **dilate1**: Base + 1px dilation of erase mask
4. **inpaint**: cv2.inpaint on erased regions instead of white fill
5. **black**: Black erasing instead of white fill
6. (Note: dilation tests failed earlier, removed from later runs)

## Results

### spike_p8_Co-TB_0 (Tenor-Bass, 22 stems-up, 9 stems-down)

| Variant | Up Notes | Down Notes | Up MIDI | Down MIDI | MIDI Diff | Pass |
|---------|----------|------------|---------|-----------|-----------|------|
| base    | 8        | 8          | 53.8    | 53.8      | 0.0       | NO   |
| blur5   | 8        | 8          | 53.8    | 53.8      | 0.0       | NO   |
| inpaint | 8        | 8          | 53.8    | 53.8      | 0.0       | NO   |
| black   | 8        | 8          | 53.8    | 53.8      | 0.0       | NO   |

### spike_p13_Co-SA_0 (Soprano-Alto, 16 stems-up, 23 stems-down)

| Variant | Up Notes | Down Notes | Up MIDI | Down MIDI | MIDI Diff | Pass |
|---------|----------|------------|---------|-----------|-----------|------|
| base    | 7        | 8          | 60.6    | 61.1      | -0.5      | NO   |
| blur5   | 7        | 8          | 60.6    | 61.1      | -0.5      | NO   |
| inpaint | 8        | 8          | 61.1    | 61.1      | 0.0       | NO   |
| black   | 8        | 8          | 61.1    | 61.1      | 0.0       | NO   |

**Success criterion**: Both crops must yield ≥1 pitched notes per voice AND mean_midi(up) > mean_midi(down).

**Result**: 0 of 2 crops met the criterion. HYPOTHESIS FAILED.

## Root Cause Analysis

### Problem 1: Invariant MIDI Output
Despite erasing one voice completely, homr extracts the **same pitched notes and mean MIDI values** from both images. This indicates:

- **Pitch extraction is position-independent**: homr's neural network determines note pitch from the vertical position of a notehead relative to the staff lines, not from stem visual characteristics or beam patterns.
- **Erasing doesn't change notehead positions**: When we white-fill (or black-erase) one voice's stems/beams but keep noteheads and staff lines intact, the noteheads remain in the same vertical positions.
- **No voice segregation at OMR level**: The separated images still show both voices' noteheads (because they occupy different x-positions but overlapping y-ranges), so homr extracts all pitches regardless of which voice's components are erased.

### Problem 2: Unclassified Components
During implementation, discovered that ~70% of connected components (beams, accidentals, dynamics) don't directly overlap noteheads and had to be assigned via proximity. This uncertainty propagates to the erased images.

### Problem 3: Grayscale vs. Binary
Attempted grayscale erase-style images (to preserve training distribution) but homr's backbone still relies on positional encoding, not pixel intensity variations for pitch determination.

## Implications

**Image-level voice separation before OMR is infeasible** with this approach. The neural network's inductive bias (position → pitch) makes it impossible to separate voices via image manipulation alone.

## Viable Alternatives

1. **XML-level separation**: Run homr on full staff, then post-process MusicXML to split <voice> tags (current fallback)
2. **Fine-tune homr on separated staves**: Retrain on binarized separated images (requires significant training data)
3. **Multi-voice OMR engine**: Use an engine with explicit voice-stream outputs (Audiveris/oemer/SMT, but all have worse accuracy baseline)
4. **Hybrid post-processing**: Keep erase-style separation as an **analysis aid** for confidence scoring, not primary extraction

## Files Generated

- `hyp_spike_p8_Co-TB_0_up_base.png`, `_down_base.png`
- `hyp_spike_p8_Co-TB_0_up_blur5.png`, `_down_blur5.png`
- `hyp_spike_p8_Co-TB_0_up_inpaint.png`, `_down_inpaint.png`
- `hyp_spike_p8_Co-TB_0_up_black.png`, `_down_black.png`
- `hyp_spike_p13_Co-SA_0_*` (all variants)
- MusicXML outputs for each variant in same directory

## Conclusion

The hypothesis that homr can extract separate voices from erase-style partially-occluded images is **FALSE**. The OMR engine's architecture does not support image-level voice separation.

**Recommendation**: Proceed with XML-level post-processing of merged single-voice OMR output (design doc section "Integration" fallback path).
