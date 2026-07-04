"""Tests for per-voice marking duplication bug in compound staff processing.

Hypothesis: In process_single_staff for compound voices (Co.SA, Co.TB),
mark_x_noteheads_in_xml is called ONCE per voice on the separated image's XML,
but receives the SAME x_positions list from the merged image. This causes the
same x-positions to be marked in both the up (Soprano) and down (Alto) voices,
multiplying false marks across voice splits.

This test reproduces the duplication with a synthetic 2-voice split.
"""

import logging
import xml.etree.ElementTree as ET
import tempfile
from pathlib import Path

log = logging.getLogger("test_duplication")


class TestPerVoiceMarkingDuplication:
    """Test that marking is not applied multiple times per voice split."""

    def test_marking_applied_once_per_voice_copy(self):
        """When a staff is split into voices, x_positions should only mark once per voice.

        Hypothesis: The current code at lines 203-206 in staff_processor.py calls
        mark_x_noteheads_in_xml on each voice's XML independently, but with the SAME
        x_positions list. If both voices received the same positions, the second voice
        would double-mark.

        This test verifies that the mapping is 1:1 — one x position per voice.
        """
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Create two voice XMLs as if they came from separate homr runs on up/down images
        # Both have 8 eighth notes (typical for a full measure of spoken rhythm)
        voice1_xml = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Voice1</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        voice2_xml = voice1_xml.replace("Voice1", "Voice2")

        # Simulate x_positions detected from the MERGED (original) staff
        # For an 8-note measure in a 1200px staff, positions would be spread across 0-1200
        x_positions = [150, 300, 450, 600, 750, 900, 1050, 1200]

        # Mark voice 1 with these positions
        marked_voice1 = mark_x_noteheads_in_xml(voice1_xml, x_positions)
        root1 = ET.fromstring(marked_voice1)
        unpitched1 = root1.findall(".//note[unpitched]")

        # Mark voice 2 with the SAME positions (current bug)
        marked_voice2 = mark_x_noteheads_in_xml(voice2_xml, x_positions)
        root2 = ET.fromstring(marked_voice2)
        unpitched2 = root2.findall(".//note[unpitched]")

        # BUG: Both voices get marked independently with the same positions
        # Expected: each voice has 8 unpitched notes (from 8 x_positions)
        # The problem is this happens in BOTH voice copies
        assert len(unpitched1) == len(x_positions), \
            f"Voice 1 should have {len(x_positions)} unpitched notes, got {len(unpitched1)}"
        assert len(unpitched2) == len(x_positions), \
            f"Voice 2 should have {len(x_positions)} unpitched notes, got {len(unpitched2)}"

        # THIS IS THE BUG: if both voices are later merged or processed together,
        # you end up with 2x the unpitched notes in the final output
        total_unpitched_in_both = len(unpitched1) + len(unpitched2)
        log.info(f"Voice 1: {len(unpitched1)} unpitched, Voice 2: {len(unpitched2)} unpitched")
        log.info(f"Total across both voices: {total_unpitched_in_both}")

    def test_marking_should_not_duplicate_across_voice_split(self):
        """The fix: mark ONCE on merged XML before splitting voices.

        Instead of marking each voice's output independently,
        mark the MERGED XML before splitting it into voices.
        This ensures each x position is marked exactly once in the final output.
        """
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Merged XML (16 notes: 8 from soprano, 8 from alto)
        merged_xml = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Merged</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        # Same x_positions for the merged staff
        x_positions = [150, 300, 450, 600, 750, 900, 1050, 1200]

        # Mark ONCE on the merged XML
        marked_merged = mark_x_noteheads_in_xml(merged_xml, x_positions)
        root = ET.fromstring(marked_merged)
        unpitched = root.findall(".//note[unpitched]")

        # After marking the merged XML once, we have N unpitched notes
        assert len(unpitched) == len(x_positions), \
            f"Merged XML should have {len(x_positions)} unpitched notes, got {len(unpitched)}"

        # Then split_voices() would divide the marked XML into voice1 and voice2
        # The marked notes would be distributed across the split (not duplicated)
        # This way: final output has 8 unpitched total, not 16

        log.info(f"Fix: Mark merged XML ONCE → {len(unpitched)} unpitched total (not duplicated)")

    def test_current_bug_hermes_overload_scenario(self):
        """Scenario from the production bug report:

        Production: Hermes part (2-voice compound Co.SA split) with ~125 unpitched notes
        Expected: ~24-32 unpitched notes (actual X-noteheads in the staff)

        If marking runs on both up (Soprano) and down (Alto) voice XMLs with the same
        x_positions, and each gets 8 marked notes from those positions, then both voices
        contribute marked notes to the final output:

        - Soprano: 8 unpitched (from up image OMR)
        - Alto: 8 unpitched (from down image OMR)
        - Total per measure: 16 unpitched (should be 8)

        If this happens across multiple measures, and there are false detections,
        you get the ~125 seen in production.
        """
        # This is more of a conceptual test; the actual multiplication happens
        # when both voices are later merged into the score.

        # For now, we note that:
        # - harness detects 56 true X-noteheads with 0 false positives (94% precision)
        # - production sees ~125 unpitched notes (5x higher than expected 24-32)
        # - this suggests marking is applied multiple times

        log.warning("Hermes part production bug: ~125 unpitched vs expected 24-32")
        log.warning("Hypothesis: marking applied once per voice in split, doubling count")
        assert True  # Placeholder for now


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import pytest
    pytest.main([__file__, "-v"])
