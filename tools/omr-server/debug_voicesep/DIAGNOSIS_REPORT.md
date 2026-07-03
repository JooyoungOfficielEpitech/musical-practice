# homr Voice Separation Diagnosis Report

## Test Overview
Tested homr on 6 Co.SA (Soprano-Alto) and Co.TB (Tenor-Bass) shared staff crops from reference pages 001, 008, 013.

## Test Results Summary

| Crop | Page | Type | Measures | Pitched Notes | Voices | Chord Notes | Pitch Summary |
|------|------|------|----------|---------------|--------|-------------|---------------|
| page_008_Co.SA_sys1 | 008 | Co.SA | 4 | 8 | 1 | 3 | B3 B3 F4 B4 F4 |
| page_008_Co.TB_sys2 | 008 | Co.TB | 5 | 8 | 1 | 3 | B2 B2 F3 A3 G3 |
| page_013_Co.SA_sys0 | 013 | Co.SA | 4 | 8 | 1 | 4 | D4 A3 E4 B3 E4 |
| page_013_Co.TB_sys1 | 013 | Co.TB | 4 | 8 | 1 | 3 | B2 B2 F3 B3 F3 |
| page_001_Co.SA_sys1 | 001 | Co.SA | 5 | 8 | 1 | 4 | D4 B3 D4 B3 D4 |
| page_001_Co.TB_sys0 | 001 | Co.TB | 6 | 4 | 1 | 2 | B3 B2 B3 B2 |

## Key Finding: homr Does NOT Emit Multiple Voices

**100% of tested crops show only 1 voice (voice_id="1")**

Despite clear visual evidence of two distinct voice lines on shared staves (separate noteheads, different stems, alternating pitches), homr outputs all notes in a single `<voice>1</voice>`.

## What homr Actually Does Instead

### 1. Emits Chords with `<chord />` Tags
When two voices share a note duration at the same time, homr **stacks them as chords** using the `<chord/>` element rather than separate voices.

Example from page_008_Co.SA_sys1.xml:
```xml
<note>
  <pitch>
    <step>F</step>
    <octave>4</octave>
  </pitch>
  <duration>3</duration>
  <voice>1</voice>  <!-- All in voice 1 -->
  <type>quarter</type>
  <dot />
</note>
<note>
  <chord />  <!-- Marked as chord, not separate voice -->
  <pitch>
    <step>B</step>
    <alter>-1</alter>
    <octave>4</octave>
  </pitch>
  <duration>3</duration>
  <voice>1</voice>  <!-- Still voice 1 -->
</note>
```

### 2. Sequential Note Representation
When notes don't align in time, homr outputs them sequentially but still in voice 1:
- Soprano notes followed by alto notes (or vice versa)
- All tagged with `<voice>1</voice>`
- Rhythm preserved but voice semantics lost

## Visual vs. XML Evidence

### What's Actually Printed on Page
- Two staff lines (same system)
- Marked with "S" / "A" (soprano/alto) or "T" / "B" (tenor/bass) labels
- Soprano notes: stems up, higher pitches (B3, D4, E4, F4)
- Alto notes: stems down, lower pitches in soprano clef (A3, B3, B4)
- Clear visual separation of voices with different stem directions

### What homr Produces
- Single `<voice>1</voice>` throughout
- Chord tags used to represent vertical coincidence
- No distinction between which pitch belongs to which voice
- Sequential ordering doesn't encode voice membership

## Implications

1. **homr Cannot Split Voices from SATB Shared Staves**: The model treats two-voice staves as a single voice with chords.

2. **Voice Separation Must Happen at Image Level, Not XML Level**: The voice_splitter.py module attempts to split by `<voice>` tags, but this won't work because there's only one voice.

3. **Chord-to-Voice Heuristics Needed**: Any solution must:
   - Detect which notes in a chord correspond to which voice (pitch ranges, stem directions, etc.)
   - Map soprano/alto separately (treble clef range)
   - Map tenor/bass separately (bass clef range)

4. **No Frequency of Multi-Voice Output**: homr emits multiple voices from shared staves **0% of the time** in this test set.

## Recommendation

Implement **image-level voice separation** before OMR:
- Detect shared staves from staff geometry
- Separate by stem direction (up = soprano, down = alto; up = tenor, down = bass)
- Crop into individual voice images
- Run homr on separated crops independently
- Merge results back at the character level
