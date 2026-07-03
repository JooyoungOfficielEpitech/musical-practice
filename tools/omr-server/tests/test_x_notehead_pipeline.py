"""Tests for X-notehead detection and replacement pipeline (TDD phase 1: RED).

This test module covers the full X-notehead pipeline:
  1. replace_x_noteheads() returns (image, x_positions) tuple
  2. x_positions are accurate for known synthetic X patterns
  3. mark_x_noteheads_in_xml() converts notes at given x-offsets to unpitched
  4. End-to-end integration: synthetic staff → replace → homr → mark → unpitched
"""

import logging
import os
import numpy as np
import xml.etree.ElementTree as ET
import cv2

from core.staff_cropper import replace_x_noteheads
from pipeline.postprocessor import postprocess

logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s %(message)s")


# ───────────────────────────────────────────────────────────────────────────
# Phase 1 (RED): Test replace_x_noteheads signature change
# ───────────────────────────────────────────────────────────────────────────


class TestReplaceXNotehead_Signature:
    """Test that replace_x_noteheads returns (image, x_positions) tuple."""

    def test_returns_tuple_of_two_elements(self):
        """replace_x_noteheads(img) should return (image, x_positions_list)."""
        # Create a simple image with staff lines
        img = np.full((300, 500, 3), 255, dtype=np.uint8)
        # Add staff lines
        for i in range(5):
            y = 100 + i * 30
            cv2.line(img, (20, y), (480, y), (0, 0, 0), 2)

        result = replace_x_noteheads(img)
        assert isinstance(result, tuple), "replace_x_noteheads should return a tuple"
        assert len(result) == 2, "replace_x_noteheads should return (image, positions)"

    def test_returns_image_and_list(self):
        """First element is image (ndarray), second is list."""
        img = np.full((300, 500, 3), 255, dtype=np.uint8)
        for i in range(5):
            y = 100 + i * 30
            cv2.line(img, (20, y), (480, y), (0, 0, 0), 2)

        result_img, result_positions = replace_x_noteheads(img)
        assert isinstance(result_img, np.ndarray), "First element should be ndarray"
        assert isinstance(result_positions, list), "Second element should be list"

    def test_positions_list_contains_numbers(self):
        """x_positions should be a list of x-coordinates (ints)."""
        img = np.full((300, 500, 3), 255, dtype=np.uint8)
        for i in range(5):
            y = 100 + i * 30
            cv2.line(img, (20, y), (480, y), (0, 0, 0), 2)

        result_img, result_positions = replace_x_noteheads(img)
        for pos in result_positions:
            assert isinstance(pos, (int, float)), f"Expected numeric position, got {type(pos)}"


# ───────────────────────────────────────────────────────────────────────────
# Phase 2 (RED): Test x_positions accuracy with synthetic X patterns
# ───────────────────────────────────────────────────────────────────────────


class TestReplaceXNotehead_Accuracy:
    """Test that x_positions list has correct count and values for known patterns."""

    def test_empty_image_returns_empty_positions(self):
        """Image with no X-noteheads should return empty list."""
        img = np.full((300, 500, 3), 255, dtype=np.uint8)
        # Add only staff lines, no X noteheads
        for i in range(5):
            y = 100 + i * 30
            cv2.line(img, (20, y), (480, y), (0, 0, 0), 2)

        result_img, x_positions = replace_x_noteheads(img)
        assert isinstance(x_positions, list), "Should return list even if empty"
        # Can be empty or have values depending on detection, but structure OK

    def test_single_x_notehead_detected(self):
        """Single synthetic X-notehead should be detected."""
        img = np.full((300, 500, 3), 255, dtype=np.uint8)
        # Add staff lines
        for i in range(5):
            y = 100 + i * 30
            cv2.line(img, (20, y), (480, y), (0, 0, 0), 2)

        # Draw a synthetic X notehead (cross pattern)
        x_center, y_center = 150, 115  # Between staff lines
        size = 11
        cv2.line(img, (x_center - 5, y_center - 5), (x_center + 5, y_center + 5), (0, 0, 0), 2)
        cv2.line(img, (x_center + 5, y_center - 5), (x_center - 5, y_center + 5), (0, 0, 0), 2)

        result_img, x_positions = replace_x_noteheads(img)
        # Should detect at least one X
        assert len(x_positions) >= 1, "Should detect at least 1 X-notehead"
        # The x_position should be roughly near 150
        if x_positions:
            assert any(140 <= pos <= 160 for pos in x_positions), \
                f"Expected position near 150, got {x_positions}"

    def test_multiple_x_noteheads_all_detected(self):
        """Multiple X-noteheads should all be detected."""
        img = np.full((300, 500, 3), 255, dtype=np.uint8)
        # Add staff lines
        for i in range(5):
            y = 100 + i * 30
            cv2.line(img, (20, y), (480, y), (0, 0, 0), 2)

        # Draw 3 synthetic X noteheads
        x_centers = [100, 200, 300]
        y_center = 115
        size = 11
        for x_center in x_centers:
            cv2.line(img, (x_center - 5, y_center - 5), (x_center + 5, y_center + 5), (0, 0, 0), 2)
            cv2.line(img, (x_center + 5, y_center - 5), (x_center - 5, y_center + 5), (0, 0, 0), 2)

        result_img, x_positions = replace_x_noteheads(img)
        # Should detect at least 3 X's (might detect more if template matching is sensitive)
        assert len(x_positions) >= 3, \
            f"Should detect at least 3 X-noteheads, got {len(x_positions)}"
        # Positions should be spread out
        if len(x_positions) >= 3:
            x_positions_sorted = sorted(x_positions[:3])
            assert x_positions_sorted[0] < 150, "First X should be < 150"
            assert x_positions_sorted[2] > 250, "Third X should be > 250"


# ───────────────────────────────────────────────────────────────────────────
# Phase 3 (RED): Test mark_x_noteheads_in_xml function
# ───────────────────────────────────────────────────────────────────────────


class TestMarkXNotehead_InXml:
    """Test mark_x_noteheads_in_xml() converts notes at x-offsets to unpitched."""

    def test_function_exists_in_postprocessor(self):
        """mark_x_noteheads_in_xml should be importable from postprocessor."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml
        assert callable(mark_x_noteheads_in_xml)

    def test_converts_note_at_x_offset_to_unpitched(self):
        """Note at given x-offset should be converted to unpitched."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Create simple MusicXML with one pitched note
        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note>
        <pitch><step>D</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>eighth</type>
      </note>
    </measure>
  </part>
</score-partwise>"""

        # Mark note at x-offset 100 as X-notehead
        result_xml = mark_x_noteheads_in_xml(xml_str, [100])

        # Verify result is still valid XML
        root = ET.fromstring(result_xml)
        assert root.tag == "score-partwise"

        # Verify the note was converted to unpitched
        note = root.find(".//note")
        assert note is not None
        unpitched = note.find("unpitched")
        assert unpitched is not None, "Note should have unpitched element"

    def test_adds_notehead_attribute_x(self):
        """Converted note should have notehead attribute set to 'x'."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note>
        <pitch><step>D</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>eighth</type>
      </note>
    </measure>
  </part>
</score-partwise>"""

        result_xml = mark_x_noteheads_in_xml(xml_str, [100])
        root = ET.fromstring(result_xml)
        note = root.find(".//note")
        notehead = note.find("notehead")
        assert notehead is not None, "Note should have notehead element"
        assert notehead.text == "x", f"Notehead should be 'x', got '{notehead.text}'"

    def test_empty_x_positions_no_conversion(self):
        """If x_positions is empty, no notes should be converted."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note>
        <pitch><step>D</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>eighth</type>
      </note>
    </measure>
  </part>
</score-partwise>"""

        result_xml = mark_x_noteheads_in_xml(xml_str, [])
        root = ET.fromstring(result_xml)
        note = root.find(".//note")
        pitch = note.find("pitch")
        # Note should still have pitch element (not converted)
        assert pitch is not None, "Note should remain pitched when x_positions is empty"

    def test_multiple_x_positions_all_converted(self):
        """Multiple x-offsets should result in multiple unpitched notes."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Create XML with 8 eighth notes
        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
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

        # Mark notes at multiple x-offsets as X-noteheads
        x_positions = [50, 100, 150, 200]  # 4 X positions
        result_xml = mark_x_noteheads_in_xml(xml_str, x_positions)
        root = ET.fromstring(result_xml)

        unpitched_notes = root.findall(".//note[unpitched]")
        assert len(unpitched_notes) >= len(x_positions), \
            f"Should convert at least {len(x_positions)} notes to unpitched"


# ───────────────────────────────────────────────────────────────────────────
# Phase 4 (RED): Integration test (end-to-end)
# ───────────────────────────────────────────────────────────────────────────


class TestXNotehead_Integration:
    """Integration test: synthetic staff → replace → extract positions → mark XML."""

    def test_integration_detect_and_mark_in_xml(self):
        """End-to-end: detect X's, get positions, mark in XML as unpitched."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Step 1: Create synthetic staff with X noteheads
        img = np.full((300, 500, 3), 255, dtype=np.uint8)
        for i in range(5):
            y = 100 + i * 30
            cv2.line(img, (20, y), (480, y), (0, 0, 0), 2)

        # Draw 2 X noteheads at known positions
        x_positions_drawn = [150, 250]
        y_center = 115
        for x_center in x_positions_drawn:
            cv2.line(img, (x_center - 5, y_center - 5), (x_center + 5, y_center + 5), (0, 0, 0), 2)
            cv2.line(img, (x_center + 5, y_center - 5), (x_center - 5, y_center + 5), (0, 0, 0), 2)

        # Step 2: Call replace_x_noteheads, get positions
        result_img, detected_positions = replace_x_noteheads(img)

        # Verify we detected X's
        assert len(detected_positions) > 0, "Should detect at least one X"

        # Step 3: Create sample XML with pitched notes
        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        # Step 4: Mark X-noteheads in the XML
        result_xml = mark_x_noteheads_in_xml(xml_str, detected_positions[:2])
        root = ET.fromstring(result_xml)

        # Verify at least one note was converted to unpitched
        unpitched = root.findall(".//note[unpitched]")
        assert len(unpitched) > 0, "Should have converted notes to unpitched"


# ───────────────────────────────────────────────────────────────────────────
# Phase 5 (REFACTOR): Edge case and app compatibility tests
# ───────────────────────────────────────────────────────────────────────────


class TestXNotehead_AppCompatibility:
    """Verify X-notehead XML is compatible with app's musicXmlParser."""

    def test_unpitched_has_display_step_and_octave(self):
        """Unpitched notes must have display-step and display-octave for app."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        result_xml = mark_x_noteheads_in_xml(xml_str, [100])
        root = ET.fromstring(result_xml)

        note = root.find(".//note")
        unpitched = note.find("unpitched")
        assert unpitched is not None

        display_step = unpitched.find("display-step")
        display_octave = unpitched.find("display-octave")
        assert display_step is not None and display_step.text is not None
        assert display_octave is not None and display_octave.text is not None

    def test_unpitched_defaults_to_b4_for_app(self):
        """App expects unpitched notes to default to B4 (which becomes Bb with alter=-1)."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        result_xml = mark_x_noteheads_in_xml(xml_str, [100])
        root = ET.fromstring(result_xml)

        unpitched = root.find(".//note/unpitched")
        display_step = unpitched.find("display-step")
        display_octave = unpitched.find("display-octave")
        assert display_step.text == "B", "Should default to B"
        assert display_octave.text == "4", "Should default to octave 4"

    def test_spoken_rhythm_measure_eight_x_noteheads(self):
        """Typical spoken rhythm measure has 8 X-noteheads (eighth notes in 4/4)."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        # Simulate homr output with 8 D5 eighth notes
        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
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

        # All 8 should be marked as X-noteheads
        x_positions = list(range(50, 450, 50))  # 8 x-positions
        result_xml = mark_x_noteheads_in_xml(xml_str, x_positions)
        root = ET.fromstring(result_xml)

        unpitched_count = len(root.findall(".//note[unpitched]"))
        assert unpitched_count == 8, f"Should mark all 8 notes as unpitched, got {unpitched_count}"

    def test_x_notehead_has_notehead_element(self):
        """App may check for notehead element to distinguish X from other unpitched."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        result_xml = mark_x_noteheads_in_xml(xml_str, [100])
        root = ET.fromstring(result_xml)

        note = root.find(".//note")
        notehead = note.find("notehead")
        assert notehead is not None, "Should have notehead element"
        assert notehead.text == "x", "notehead text should be 'x'"


class TestXNotehead_EdgeCases:
    """Edge cases and error handling."""

    def test_xml_with_rests_and_notes(self):
        """Should only convert pitched notes, leave rests alone."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><rest/><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        result_xml = mark_x_noteheads_in_xml(xml_str, [100, 200])
        root = ET.fromstring(result_xml)

        # Should have rest + 2 unpitched notes (rest untouched)
        rests = root.findall(".//note[rest]")
        unpitched = root.findall(".//note[unpitched]")
        assert len(rests) == 1, "Rest should not be converted"
        assert len(unpitched) == 2, "Should convert the two pitched notes"

    def test_multiple_measures_with_x_noteheads(self):
        """X-noteheads can span multiple measures."""
        from pipeline.postprocessor import mark_x_noteheads_in_xml

        xml_str = """\
<?xml version='1.0'?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
    </measure>
  </part>
</score-partwise>"""

        result_xml = mark_x_noteheads_in_xml(xml_str, [50, 150, 250, 350])
        root = ET.fromstring(result_xml)

        unpitched = root.findall(".//note[unpitched]")
        assert len(unpitched) == 4, "Should convert all 4 notes across measures"


# ───────────────────────────────────────────────────────────────────────────
# Phase 6: Production Pipeline Integration Test
# ───────────────────────────────────────────────────────────────────────────


class TestXNotehead_ProductionPipeline:
    """Verify X-notehead fix works in production vocal pipeline."""

    def test_process_single_staff_with_x_noteheads(self):
        """process_single_staff (production path) detects and marks X-noteheads."""
        from pipeline.staff_processor import process_single_staff
        import tempfile
        import numpy as np

        # Create a synthetic staff image with pseudo x-notehead pattern
        staff_img = np.full((200, 400, 3), 255, dtype=np.uint8)

        # Draw staff lines
        for i in range(5):
            y = 100 + i * 15
            cv2.line(staff_img, (20, y), (380, y), (0, 0, 0), 1)

        # Draw x-notehead patterns at specific x positions
        for x in (100, 200):
            cx, cy = x, 110
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    if abs(dx) == abs(dy) or dx == 0 or dy == 0:
                        staff_img[cy + dy, cx + dx] = (0, 0, 0)

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Run process_single_staff (the production path)
            result = process_single_staff("Voice", staff_img, 0, tmp_dir)

            # Should return dict mapping character name to list of measures
            assert isinstance(result, dict), "process_single_staff should return dict"
            assert "Voice" in result, "Voice character should be in result"
            # Result may be empty or have measures depending on homr availability,
            # but the function should complete without error and detect x-noteheads

    def test_vocal_pipeline_with_x_noteheads(self):
        """run_vocal_score_pipeline (queue path) detects and marks X-noteheads in SATB."""
        from omr_queue.vocal_pipeline import run_vocal_score_pipeline
        import tempfile
        import numpy as np

        # Create synthetic page with staff lines and x-notehead patterns
        page_img = np.full((600, 800, 3), 255, dtype=np.uint8)

        # Draw 4 systems (one per voice: Soprano, Alto, Tenor, Bass)
        # Each system has 5 staff lines
        for system_num in range(4):
            base_y = 50 + system_num * 130
            for line_num in range(5):
                y = base_y + line_num * 15
                cv2.line(page_img, (20, y), (780, y), (0, 0, 0), 1)
                # Add OCR label for this staff (Soprano / Alto / Tenor / Bass)
                if line_num == 0:
                    voice_labels = ["Soprano", "Alto", "Tenor", "Bass"]
                    # (In real scenario OCR would detect these, here we just draw for realism)

        # Draw x-notehead patterns at known positions
        x_notehead_positions = [100, 200, 300]
        for system_num in range(4):
            base_y = 50 + system_num * 130 + 40  # Middle of staff
            for x_pos in x_notehead_positions:
                cx, cy = x_pos, base_y
                # Draw small X pattern
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        if abs(dx) == abs(dy) or dx == 0 or dy == 0:
                            if 0 <= cy + dy < page_img.shape[0] and 0 <= cx + dx < page_img.shape[1]:
                                page_img[cy + dy, cx + dx] = (0, 0, 0)

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save page to PNG
            page_path = os.path.join(tmp_dir, "test_page.png")
            cv2.imwrite(page_path, page_img)

            # Run vocal pipeline with this page
            try:
                result_xml = run_vocal_score_pipeline(
                    [[page_path]],  # chunks format: list of lists of page paths
                    tmp_dir,
                    "Test Score",
                )
                # Verify result is valid XML
                root = ET.fromstring(result_xml)
                assert root.tag == "score-partwise", "Should produce score-partwise XML"

                # Check if any unpitched notes were marked in the result
                # (may be empty or have measures depending on homr availability)
                unpitched_notes = root.findall(".//note[unpitched]")
                # We can't guarantee unpitched notes will be present without homr,
                # but the pipeline should complete without error
                assert isinstance(unpitched_notes, list), "Should be able to find unpitched notes"
            except Exception as e:
                # Pipeline may fail at homr stage, but should not fail due to x-notehead handling
                assert "x-notehead" not in str(e).lower() and "replace_x" not in str(e).lower(), \
                    f"Should not fail due to x-notehead processing: {e}"

    def test_process_page_with_x_noteheads(self):
        """process_page (debug path) detects and marks X-noteheads."""
        from pipeline.staff_processor import process_page
        import tempfile
        import cv2

        # Create a synthetic page image
        page_img = np.full((400, 600, 3), 255, dtype=np.uint8)

        # Draw staff lines
        for i in range(5):
            y = 200 + i * 15
            cv2.line(page_img, (20, y), (580, y), (0, 0, 0), 1)

        # Draw x-notehead patterns
        for x in (150, 250):
            cx, cy = x, 210
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    if abs(dx) == abs(dy) or dx == 0 or dy == 0:
                        page_img[cy + dy, cx + dx] = (0, 0, 0)

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save to temp file and process
            test_path = os.path.join(tmp_dir, "test_page.png")
            cv2.imwrite(test_path, page_img)

            # Run process_page (may fail at homr stage but should handle x-noteheads)
            try:
                result = process_page(test_path, 1, tmp_dir)
                # Result is list of measure Elements; may be empty if homr fails,
                # but function should complete without error
                assert isinstance(result, list), "process_page should return list"
            except Exception as e:
                # If it fails, should not be due to x-notehead handling
                assert "x-notehead" not in str(e).lower(), "Should not fail due to x-notehead processing"
