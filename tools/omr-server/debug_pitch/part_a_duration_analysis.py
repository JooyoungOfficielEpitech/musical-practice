#!/usr/bin/env python3
"""Part A: Rhythm/Duration accuracy analysis for Hermes part on page 1.

Ground truth from reference/ground_truth.md:
- M1-M2: Whole rests
- M3: Whole note Bb4
- M4: Half note Bb4 + half rest (with fermata)
- M5-M6: Whole rests
- M7: Dotted-quarter D5 + eighth D5 + half D5
- M8: Half note D5 + half rest
- M9-M11: Whole rests
- M12-M14: 8 eighth-note "x" noteheads each

Procedure:
1. Crop Hermes staves from page 1 using crop_all_vocal_staves
2. Run homr on crops and collect note durations
3. Compare to ground truth and count errors
4. Identify patterns: dots dropped? halves→quarters? rests merged?
"""

import sys
import json
import re
import subprocess
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.staff_detector import (
    _binarize, _detect_staff_line_rows, _group_into_staves,
    _group_staff_lines, _group_staves_into_systems, _to_gray,
    _crop_single_staff
)
from core.label_ocr import _assign_labels_by_position


class NoteDuration(NamedTuple):
    """A single note from homr output."""
    measure: int
    pitch: str
    midi: int
    duration: float  # in quarter-note units (0.25 = sixteenth, 0.5 = eighth, 1.0 = quarter, etc.)
    notehead_type: str  # 'normal', 'x', 'diamond', etc.


def read_image(path: str) -> np.ndarray:
    """Read and return image as BGR."""
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot read {path}")
    return img


def crop_all_vocal_staves_simple(img_path: str) -> dict[str, np.ndarray]:
    """Crop all vocal staves from the score using the existing pipeline.

    Returns dict: {stave_label: [crop_images]}
    """
    from core.staff_cropper import crop_all_vocal_staves as crop_func

    img = read_image(img_path)

    # Use the existing cropper
    character_names = ["Hermes", "Company S/A", "Company T/B", "Lead Sheet"]
    staves_dict, system_info = crop_func(img, character_names=character_names)

    # Flatten: return {label: first_image_for_that_label}
    crops = {}
    for label, image_list in staves_dict.items():
        if image_list:
            crops[label] = image_list[0][0]  # Get the first image from the first system

    print(f"Cropped staves: {list(crops.keys())}")
    return crops


def run_homr_on_image(img_path: str, xml_out: str) -> None:
    """Run homr on image and output MusicXML."""
    venv_homr = Path(__file__).parent.parent / "venv" / "bin" / "homr"
    if not venv_homr.exists():
        print(f"Warning: {venv_homr} not found; using global homr")
        venv_homr = "homr"

    cmd = [str(venv_homr), str(img_path)]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"homr error:\n{result.stderr}")
        raise RuntimeError(f"homr failed: {result.stderr}")

    # homr outputs XML to stdout
    xml_content = result.stdout
    with open(xml_out, 'w') as f:
        f.write(xml_content)
    print(f"homr succeeded, output written to {xml_out}")


def parse_musicxml_notes(xml_path: str) -> list[NoteDuration]:
    """Parse MusicXML file and extract note durations.

    Returns list of (measure, pitch, midi, duration_quarters, notehead_type).
    """
    try:
        from xml.etree import ElementTree as ET
    except ImportError:
        print("Warning: ElementTree not available")
        return []

    tree = ET.parse(xml_path)
    root = tree.getroot()

    notes = []
    current_measure = 1

    # XML namespace
    ns = {'': 'http://www.w3.org/2000/svg'}

    for part in root.findall('.//part'):
        for measure_elem in part.findall('.//measure'):
            measure_num = measure_elem.get('number', str(current_measure))
            try:
                current_measure = int(measure_num)
            except ValueError:
                pass

            for note_elem in measure_elem.findall('.//note'):
                # Skip rests
                if note_elem.find('.//rest') is not None:
                    continue

                # Get pitch
                pitch_elem = note_elem.find('.//pitch')
                if pitch_elem is None:
                    continue

                step = pitch_elem.findtext('step', '')
                octave = pitch_elem.findtext('octave', '0')
                if not step:
                    continue

                pitch_str = f"{step}{octave}"
                midi = pitch_to_midi(pitch_str)

                # Get duration (in terms of divisions)
                dur_str = note_elem.findtext('.//duration', '0')
                try:
                    duration = int(dur_str)
                except ValueError:
                    duration = 0

                # Get divisions (quarter-note = divisions)
                divisions = 4  # default
                attr = measure_elem.find('.//attributes')
                if attr is not None:
                    div_str = attr.findtext('.//divisions', '4')
                    try:
                        divisions = int(div_str)
                    except ValueError:
                        pass

                duration_quarters = duration / divisions if divisions > 0 else 0

                # Get notehead type
                notehead = note_elem.findtext('.//notehead', 'normal')

                notes.append(NoteDuration(
                    measure=current_measure,
                    pitch=pitch_str,
                    midi=midi,
                    duration=duration_quarters,
                    notehead_type=notehead
                ))

    return notes


def pitch_to_midi(pitch_str: str) -> int:
    """Convert pitch string like 'C4' to MIDI number (C4=60)."""
    m = re.match(r'([A-G])([#b]?)(\d+)', pitch_str)
    if not m:
        return 0

    note_name, accidental, octave = m.groups()
    octave = int(octave)

    note_values = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    midi = 12 * (octave + 1) + note_values[note_name]

    if accidental == '#':
        midi += 1
    elif accidental == 'b':
        midi -= 1

    return midi


def midi_to_pitch(midi: int) -> str:
    """Convert MIDI number to pitch string."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (midi // 12) - 1
    note = note_names[midi % 12]
    return f"{note}{octave}"


def main():
    """Main analysis."""
    page1_path = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/reference/하데스타운 악보 통합본-001.png"
    output_dir = Path("/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_pitch")
    output_dir.mkdir(exist_ok=True)

    print("=" * 80)
    print("PART A: DURATION ACCURACY ANALYSIS")
    print("=" * 80)

    # Step 1: Crop Hermes staves
    print("\n[Step 1] Cropping vocal staves from page 1...")
    crops = crop_all_vocal_staves_simple(page1_path)
    print(f"Crops obtained: {list(crops.keys())}")

    # Step 2: Run homr on Hermes crop
    hermes_crop = crops.get("Herm.")
    if hermes_crop is None:
        hermes_crop = crops.get("Hermes")
    if hermes_crop is None:
        print(f"ERROR: No Hermes crop found! Available: {list(crops.keys())}")
        return

    hermes_crop_path = output_dir / "hermes_crop.png"
    cv2.imwrite(str(hermes_crop_path), hermes_crop)
    print(f"Saved Hermes crop: {hermes_crop_path}")

    hermes_xml = output_dir / "hermes_raw.xml"
    print(f"\n[Step 2] Running homr on Hermes crop...")
    try:
        run_homr_on_image(str(hermes_crop_path), str(hermes_xml))
    except Exception as e:
        print(f"ERROR running homr: {e}")
        return

    # Step 3: Parse notes from XML
    print(f"\n[Step 3] Parsing MusicXML output...")
    notes = parse_musicxml_notes(str(hermes_xml))
    print(f"Parsed {len(notes)} notes")

    # Ground truth durations (in quarter-note units)
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

    # Analyze by measure
    print("\n" + "=" * 80)
    print("DURATION ACCURACY REPORT")
    print("=" * 80)

    total_correct = 0
    total_incorrect = 0
    errors_by_type = {}

    for measure_num in sorted(set(n.measure for n in notes) | set(ground_truth.keys())):
        if measure_num not in ground_truth:
            print(f"\nM{measure_num}: NOT IN GROUND TRUTH (skipping)")
            continue

        notes_in_measure = [n for n in notes if n.measure == measure_num]
        truth = ground_truth[measure_num]

        print(f"\nM{measure_num}:")
        print(f"  Ground truth: {truth}")
        print(f"  Homr output: {[(n.pitch, n.duration) for n in notes_in_measure]}")

        # Compare counts
        notes_count = len([n for n in notes_in_measure if n.notehead_type != 'rest'])
        rest_count = len([n for n in notes_in_measure if n.notehead_type == 'rest'])
        truth_count = len([t for t in truth if t[0] != 'rest'])
        truth_rest_count = len([t for t in truth if t[0] == 'rest'])

        if notes_count + rest_count != truth_count + truth_rest_count:
            error_msg = f"Count mismatch: homr={notes_count + rest_count}, truth={truth_count + truth_rest_count}"
            print(f"  ERROR: {error_msg}")
            errors_by_type[error_msg] = errors_by_type.get(error_msg, 0) + 1
            total_incorrect += 1
        else:
            # Check durations match
            homr_durs = sorted([n.duration for n in notes_in_measure if n.notehead_type != 'rest'])
            truth_durs = sorted([t[1] for t in truth if t[0] != 'rest'])

            if homr_durs == truth_durs:
                print(f"  ✓ CORRECT (durations match)")
                total_correct += 1
            else:
                error_msg = f"Duration mismatch: homr={homr_durs}, truth={truth_durs}"
                print(f"  ERROR: {error_msg}")
                errors_by_type[error_msg] = errors_by_type.get(error_msg, 0) + 1
                total_incorrect += 1

    # Summary
    print("\n" + "=" * 80)
    print(f"SUMMARY: {total_correct} correct, {total_incorrect} incorrect")
    print(f"Accuracy: {total_correct / (total_correct + total_incorrect) * 100:.1f}%")
    print("\nError patterns:")
    for error_type, count in sorted(errors_by_type.items(), key=lambda x: -x[1]):
        print(f"  - {error_type}: {count} measures")

    # Save results
    results = {
        'total_measures': total_correct + total_incorrect,
        'correct': total_correct,
        'incorrect': total_incorrect,
        'accuracy_percent': total_correct / (total_correct + total_incorrect) * 100,
        'error_patterns': errors_by_type,
    }

    results_json = output_dir / "part_a_results.json"
    with open(results_json, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {results_json}")


if __name__ == '__main__':
    main()
