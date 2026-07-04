"""Test that reproduces the voice-separation marking bug.

Bug: In process_single_staff, when voice separation succeeds (line 153),
the code runs homr separately on the up_img and down_img. For each voice,
it calls mark_x_noteheads_in_xml with x_positions from the MERGED image.

This causes the same x-positions to be marked in BOTH the up voice XML
and the down voice XML independently, effectively doubling the marked notes
in the final score (or more, if there are false detections).

Fix: Mark should only apply to the merged XML (before splitting),
or the positions should be adjusted per voice (not done here).
"""

import logging
import tempfile
import numpy as np
import cv2
import xml.etree.ElementTree as ET
from pathlib import Path

log = logging.getLogger("test_voice_sep_marking_bug")


class TestVoiceSeparationMarkingBug:
    """Test the marking duplication bug in voice-separated processing."""

    def test_voice_separation_without_marking_works(self):
        """First verify that voice separation itself works (without marking)."""
        from core.staff_cropper import replace_x_noteheads
        from core.voice_separator import separate_voices_image

        # Create a synthetic compound staff (up notes at y=80, down notes at y=140)
        # with shared staff lines at y=100,115,130,145,160
        staff_img = np.full((200, 400, 3), 255, dtype=np.uint8)

        # Draw staff lines
        for y in [80, 95, 110, 125, 140]:
            cv2.line(staff_img, (0, y), (399, y), (0, 0, 0), 1)

        # Draw some noteheads (simple circles to represent notes)
        # Up voice noteheads (above middle line 110)
        for x in [100, 150, 200]:
            cv2.circle(staff_img, (x, 95), 3, (0, 0, 0), -1)

        # Down voice noteheads (below middle line 110)
        for x in [120, 170, 220]:
            cv2.circle(staff_img, (x, 125), 3, (0, 0, 0), -1)

        # Call replace_x_noteheads (should not find many X's in synthetic image)
        processed, x_positions, staff_width = replace_x_noteheads(staff_img)
        log.info(f"Processed image, detected x_positions: {x_positions}")

        # Try voice separation
        sep_result = separate_voices_image(processed)
        if sep_result is not None:
            log.info(f"Voice separation succeeded: {sep_result.n_up} up, {sep_result.n_down} down")
            assert sep_result.up_img is not None, "Should have up image"
            assert sep_result.down_img is not None, "Should have down image"

    def test_marking_same_positions_on_both_voices_is_the_bug(self):
        """Document the bug: marking the same x_positions on both separated voices.

        Scenario from staff_processor.py lines 203-206:
        ```python
        if x_positions:
            if X_MARKING_ENABLED:
                voice_xml = mark_x_noteheads_in_xml(voice_xml, x_positions)
        ```

        This is called for BOTH the up voice (line 205) and down voice (line 205),
        with the SAME x_positions list from the merged image.
        """
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Simulate homr output for up voice (from up_img)
        up_voice_xml = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Up</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        # Simulate homr output for down voice (from down_img)
        down_voice_xml = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Down</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        # x_positions detected from the MERGED staff (line 126: replace_x_noteheads(cleaned))
        # Suppose the merged staff detected 4 X-noteheads (one per note)
        x_positions = [100, 150, 200, 250]

        # BUG: Call marking on both voices independently with the same positions
        # This is what staff_processor.py lines 203-206 do:
        marked_up = mark_x_noteheads_in_xml(up_voice_xml, x_positions)
        marked_down = mark_x_noteheads_in_xml(down_voice_xml, x_positions)

        # Parse results
        root_up = ET.fromstring(marked_up)
        root_down = ET.fromstring(marked_down)

        unpitched_up = root_up.findall(".//note[unpitched]")
        unpitched_down = root_down.findall(".//note[unpitched]")

        log.warning(f"BUG: Up voice marked {len(unpitched_up)} notes as unpitched")
        log.warning(f"BUG: Down voice marked {len(unpitched_down)} notes as unpitched")
        log.warning(f"BUG: Total marked = {len(unpitched_up) + len(unpitched_down)} (should be {len(x_positions)})")

        # Both voices independently received all x_positions
        assert len(unpitched_up) == len(x_positions), \
            f"Up voice has {len(unpitched_up)} unpitched, expected {len(x_positions)}"
        assert len(unpitched_down) == len(x_positions), \
            f"Down voice has {len(unpitched_down)} unpitched, expected {len(x_positions)}"

        # If both voices are later merged into the score, the total unpitched count
        # would be 2x what it should be (or more with false detections)
        total_duplication_factor = (len(unpitched_up) + len(unpitched_down)) / len(x_positions)
        log.warning(f"Duplication factor: {total_duplication_factor}x")
        assert total_duplication_factor == 2.0, "Both voices got the same marks → 2x duplication"

    def test_fix_mark_merged_before_split(self):
        """Fix: Mark the merged XML before splitting into voices.

        Instead of calling mark_x_noteheads_in_xml on separated voice outputs,
        call it once on the merged XML (if separation succeeds), then split.

        Pseudocode:
        ```python
        if sep_result is not None:
            # Run homr on up/down separately
            up_xml = run_homr(sep_result.up_img, ...)
            down_xml = run_homr(sep_result.down_img, ...)

            # Merge the two XMLs back
            merged_xml = merge_two_xmls(up_xml, down_xml)

            # MARK ONCE on merged
            if x_positions:
                merged_xml = mark_x_noteheads_in_xml(merged_xml, x_positions)

            # THEN split into voices
            voice_parts = split_voices(merged_xml)
        ```
        """
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Hypothetical merged XML with both up and down voices' notes
        merged_xml = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Merged</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type><voice>1</voice></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><voice>2</voice></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type><voice>1</voice></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><voice>2</voice></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type><voice>1</voice></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><voice>2</voice></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><type>eighth</type><voice>1</voice></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><voice>2</voice></note>
    </measure>
  </part>
</score-partwise>"""

        x_positions = [100, 150, 200, 250]

        # Fix: Mark ONCE on merged XML
        marked_merged = mark_x_noteheads_in_xml(merged_xml, x_positions)
        root = ET.fromstring(marked_merged)
        unpitched = root.findall(".//note[unpitched]")

        log.info(f"Fix: Marked merged XML once, got {len(unpitched)} unpitched notes")
        assert len(unpitched) == len(x_positions), \
            f"Marked merged should have {len(x_positions)} unpitched, got {len(unpitched)}"

        # Now if we split_voices on the marked merged XML, the unpitched notes
        # would be distributed across the voices (not duplicated)
        # Final result: correct number of unpitched notes in the score


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    import pytest
    pytest.main([__file__, "-v"])
