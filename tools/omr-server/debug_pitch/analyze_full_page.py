#!/usr/bin/env python3
"""Analyze full-page homr output against ground truth."""

import sys
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).parent.parent))


def parse_musicxml_notes(xml_path: str) -> dict[int, list]:
    """Parse MusicXML and extract notes by measure."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    measures = {}

    for part in root.findall('.//part'):
        for measure_elem in part.findall('.//measure'):
            measure_num = int(measure_elem.get('number', 0))
            if measure_num == 0:
                continue

            notes_in_measure = []

            for note_elem in measure_elem.findall('.//note'):
                is_rest = note_elem.find('.//rest') is not None

                # Duration
                dur_str = note_elem.findtext('.//duration', '0')
                duration = int(dur_str)

                # Get divisions
                divisions = 2  # From the XML header
                attr = measure_elem.find('.//attributes')
                if attr is not None:
                    div_str = attr.findtext('.//divisions', '2')
                    divisions = int(div_str)

                duration_quarters = duration / divisions

                if is_rest:
                    notes_in_measure.append(('rest', duration_quarters))
                else:
                    # Pitch
                    pitch_elem = note_elem.find('.//pitch')
                    step = pitch_elem.findtext('step', '')
                    alter_str = pitch_elem.findtext('alter', '0')
                    octave_str = pitch_elem.findtext('octave', '0')

                    alter = int(alter_str)
                    octave = int(octave_str)

                    if alter == -1:
                        pitch = f"{step}b{octave}"
                    elif alter == 1:
                        pitch = f"{step}#{octave}"
                    else:
                        pitch = f"{step}{octave}"

                    notes_in_measure.append((pitch, duration_quarters))

            measures[measure_num] = notes_in_measure

    return measures


def main():
    xml_path = Path("/Users/mmecoco/Desktop/musical-practice/tools/omr-server/reference/하데스타운 악보 통합본-001.musicxml")

    print("=" * 80)
    print("HOMR OUTPUT ANALYSIS (Page 1 - Full Page)")
    print("=" * 80)

    notes_by_measure = parse_musicxml_notes(str(xml_path))

    print(f"\nParsed {len(notes_by_measure)} measures:\n")

    for measure_num in sorted(notes_by_measure.keys()):
        notes = notes_by_measure[measure_num]
        print(f"M{measure_num:2d}: {notes}")

    # Now compare to ground truth
    ground_truth = {
        1: [('rest', 4.0)],  # Whole rest
        2: [('rest', 4.0)],  # Whole rest
        3: [('Bb4', 4.0)],   # Whole note
        4: [('Bb4', 2.0), ('rest', 2.0)],  # Half + half rest
        5: [('rest', 4.0)],  # Whole rest
        6: [('rest', 4.0)],  # Whole rest
        7: [('D5', 1.5), ('D5', 0.5), ('D5', 2.0)],  # Dotted-q + eighth + half
        8: [('D5', 2.0), ('rest', 2.0)],  # Half + half rest
        9: [('rest', 4.0)],  # Whole rest
        10: [('rest', 4.0)],  # Whole rest
        11: [('rest', 4.0)],  # Whole rest
        12: [('x', 0.5)] * 8,  # 8 eighths
        13: [('x', 0.5)] * 8,  # 8 eighths
        14: [('x', 0.5)] * 8,  # 8 eighths
    }

    print("\n" + "=" * 80)
    print("COMPARISON TO GROUND TRUTH")
    print("=" * 80)

    correct = 0
    incorrect = 0
    errors = []

    for measure_num in sorted(ground_truth.keys()):
        truth = ground_truth[measure_num]
        homr_result = notes_by_measure.get(measure_num, [])

        # Normalize for comparison: convert B-flat to Bb
        homr_norm = [(p.replace('b', 'b').replace('#', '#'), d) for p, d in homr_result]
        truth_norm = [(p.replace('b', 'b').replace('#', '#'), d) for p, d in truth]

        # Simple duration comparison
        homr_durs = sorted([d for p, d in homr_norm])
        truth_durs = sorted([d for p, d in truth_norm])

        match = homr_durs == truth_durs

        status = "✓" if match else "✗"
        print(f"{status} M{measure_num:2d}: truth={truth}, homr={homr_result}")

        if match:
            correct += 1
        else:
            incorrect += 1
            errors.append((measure_num, truth, homr_result))

    print("\n" + "=" * 80)
    print(f"SUMMARY: {correct} correct, {incorrect} incorrect")
    if correct + incorrect > 0:
        accuracy = 100.0 * correct / (correct + incorrect)
        print(f"Accuracy: {accuracy:.1f}%")

    if errors:
        print("\nFAILED MEASURES:")
        for m, truth, homr in errors:
            print(f"  M{m}: expected {truth}, got {homr}")


if __name__ == '__main__':
    main()
