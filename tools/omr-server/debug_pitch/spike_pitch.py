"""
CV-based pitch estimation spike: notehead center y + staff lines -> pitch.

Algorithm:
1. Binarize image
2. Detect staff line rows (reuse staff_detector)
3. Detect noteheads via morphological closing + contour analysis
4. For each notehead: compute y-center, quantize to line/space index
5. Map staff-step to pitch using clef and key signature
6. Annotate with boxes and pitch labels

Testing against known ground truth crops to validate geometry-only pitch computation.
"""

import logging
from typing import Optional
import cv2
import numpy as np
import sys
from pathlib import Path

# Add parent dirs to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.staff_detector import _to_gray, _binarize, _detect_staff_line_rows, _group_staff_lines

log = logging.getLogger("spike_pitch")
logging.basicConfig(level=logging.INFO)


def _remove_staff_lines(binary: np.ndarray, lines: list[tuple[int, int]], staff_spacing: float) -> np.ndarray:
    """
    Remove staff lines from binary image by painting them white (255).

    Args:
        binary: Binarized image
        lines: List of (top, bottom) row ranges for each staff line
        staff_spacing: Distance between adjacent staff lines

    Returns:
        Binary image with staff lines removed
    """
    result = binary.copy()
    line_thickness = staff_spacing * 0.3  # Approximate line thickness
    for top, bot in lines:
        margin = int(line_thickness)
        y1 = max(0, top - margin)
        y2 = min(result.shape[0], bot + margin + 1)
        result[y1:y2, :] = 255  # Paint white (background)
    return result


def _detect_noteheads(binary: np.ndarray, staff_spacing: float) -> list[dict]:
    """
    Detect noteheads via connected components.

    Args:
        binary: Binarized image (after staff line removal).
                Foreground (noteheads) are white (255), background is black (0).
        staff_spacing: Distance between adjacent staff lines in pixels

    Returns:
        List of dicts: {x, y (center), bbox, area}
    """
    h, w = binary.shape

    # Invert so noteheads are black (0) for connected components
    binary_inv = 255 - binary
    num_labels, labels = cv2.connectedComponents(binary_inv.astype(np.uint8))

    noteheads = []
    min_area = (staff_spacing * 0.2) ** 2
    max_area = (staff_spacing * 1.5) ** 2

    for label_id in range(1, num_labels):
        component = (labels == label_id)
        area = np.count_nonzero(component)

        if area < min_area or area > max_area:
            continue

        ys, xs = np.where(component)
        x_min, x_max = xs.min(), xs.max()
        y_min, y_max = ys.min(), ys.max()
        comp_w = x_max - x_min + 1
        comp_h = y_max - y_min + 1

        # Noteheads should be roughly circular (aspect ratio ~1)
        aspect = max(comp_w, comp_h) / max(1, min(comp_w, comp_h))
        if aspect > 1.8:
            continue

        # Use centroid as notehead center
        cx = np.mean(xs)
        cy = np.mean(ys)

        noteheads.append({
            'x': cx,
            'y': cy,
            'bbox': (x_min, y_min, comp_w, comp_h),
            'area': area
        })

    return noteheads


def _compute_staff_spacing(lines: list[tuple[int, int]]) -> float:
    """Compute median spacing between staff lines."""
    if len(lines) < 2:
        return 10.0  # Fallback

    centers = [(t + b) / 2 for t, b in lines]
    spacings = [centers[i+1] - centers[i] for i in range(len(centers)-1)]
    return float(np.median(spacings))


def _staff_step_from_y(y: float, lines: list[tuple[int, int]], staff_spacing: float) -> Optional[int]:
    """
    Convert y-coordinate to staff step (line/space index within the staff).

    Staff step convention:
    - Line 0 (bottom) = 0 pixels below bottom staff line
    - Space 0 = staff_spacing/2 below bottom line
    - Line 1 = staff_spacing below bottom line
    - ... etc to Line 4 (top)
    - Ledger lines above and below map to steps 5+ and -1-

    Returns integer step index, or None if outside reasonable range.
    """
    if not lines:
        return None

    # Get staff bounds from line positions
    line_centers = [(t + b) / 2 for t, b in lines]
    bottom_y = line_centers[-1]  # Lowest (highest pixel row #) in staff

    # Distance from bottom staff line
    dist_from_bottom = bottom_y - y  # Positive if above bottom line

    # Quantize to nearest half-spacing (line or space)
    half_spacing = staff_spacing / 2
    step_float = dist_from_bottom / half_spacing
    step = round(step_float)

    return step


def _treble_pitch_from_step(step: int, key_signature: str = "Bb") -> Optional[str]:
    """
    Map staff step to pitch name in treble clef.

    Treble clef, bottom line = E3.
    Step 0 = E3 (bottom line)
    Step 1 = F3 (space)
    Step 2 = G3 (line)
    ... etc

    Key signature can flatten/sharpen: "Bb" -> Bb,Eb flattened.

    Returns pitch string like "E3", "F3", "Bb3", etc.
    """
    # Base pitches in treble (step 0 = E3)
    notes = ['E', 'F', 'G', 'A', 'B', 'C', 'D']
    octaves = [3, 3, 3, 3, 3, 4, 4]

    # Map step to note and octave
    octave_offset = step // 7
    note_idx = step % 7

    note = notes[note_idx]
    octave = octaves[note_idx] + octave_offset

    # Apply key signature
    if key_signature == "Bb":
        # Bb major: B, E flattened
        if note in ['B', 'E']:
            note = note + 'b'
    elif key_signature == "F":
        # F major: B flattened
        if note == 'B':
            note = note + 'b'

    return f"{note}{octave}"


def _bass_pitch_from_step(step: int, key_signature: str = "Bb") -> Optional[str]:
    """
    Map staff step to pitch name in bass clef.

    Bass clef, bottom line = G2.
    Step 0 = G2 (bottom line)
    Step 1 = A2 (space)
    ... etc

    Returns pitch string like "G2", "A2", "Bb2", etc.
    """
    notes = ['G', 'A', 'B', 'C', 'D', 'E', 'F']
    octaves = [2, 2, 2, 3, 3, 3, 3]

    octave_offset = step // 7
    note_idx = step % 7

    note = notes[note_idx]
    octave = octaves[note_idx] + octave_offset

    if key_signature == "Bb":
        if note in ['B', 'E']:
            note = note + 'b'
    elif key_signature == "F":
        if note == 'B':
            note = note + 'b'

    return f"{note}{octave}"


def estimate_pitches(
    img_path: str,
    clef: str = "treble",
    key_signature: str = "Bb"
) -> tuple[np.ndarray, list[dict]]:
    """
    Estimate pitches for all noteheads in a staff crop.

    Args:
        img_path: Path to crop image
        clef: "treble" or "bass"
        key_signature: "Bb", "F", "C", etc.

    Returns:
        (annotated_image, noteheads_with_pitches)
        where each notehead dict includes 'pitch', 'step', 'midi_approx' fields.
    """
    img = cv2.imread(img_path)
    if img is None:
        log.error(f"Failed to load {img_path}")
        return None, []

    gray = _to_gray(img)
    binary = _binarize(gray)
    h, w = binary.shape

    # Detect staff lines
    row_mask = _detect_staff_line_rows(binary)
    lines = _group_staff_lines(row_mask)

    if len(lines) < 5:
        log.warning(f"Detected {len(lines)} staff lines; need 5. Skipping pitch estimation.")
        return img, []

    staff_spacing = _compute_staff_spacing(lines)
    log.info(f"Staff spacing: {staff_spacing:.1f} px")
    log.info(f"Detected {len(lines)} staff lines at rows: {[(t, b) for t, b in lines]}")

    # Remove staff lines before detecting noteheads
    binary_no_staff = _remove_staff_lines(binary, lines, staff_spacing)

    # Detect noteheads (on binary with staff lines removed)
    noteheads = _detect_noteheads(binary_no_staff, staff_spacing)
    log.info(f"Detected {len(noteheads)} noteheads (before filtering)")

    # Filter to keep only noteheads within reasonable staff bounds
    if lines:
        line_centers = [(t + b) / 2 for t, b in lines]
        staff_top = line_centers[0]
        staff_bottom = line_centers[-1]

        # Only keep noteheads within the staff + 1 ledger line above/below
        ledger_tolerance = staff_spacing
        noteheads = [
            nh for nh in noteheads
            if staff_top - ledger_tolerance <= nh['y'] <= staff_bottom + ledger_tolerance
        ]
        log.info(f"After position filtering: {len(noteheads)} noteheads")

    # Assign pitches
    pitch_func = _treble_pitch_from_step if clef == "treble" else _bass_pitch_from_step

    for nh in noteheads:
        step = _staff_step_from_y(nh['y'], lines, staff_spacing)
        if step is not None:
            pitch = pitch_func(step, key_signature)
            nh['step'] = step
            nh['pitch'] = pitch
            # Rough MIDI approximation (treble E3 = 40, bass G2 = 43)
            # This is approximate; real pitch depends on octave
            nh['midi_approx'] = _pitch_to_midi_approx(pitch)
        else:
            nh['step'] = None
            nh['pitch'] = "?"
            nh['midi_approx'] = None

    # Annotate image
    annotated = img.copy()
    for nh in noteheads:
        x, y, w, h = nh['bbox']
        # Draw bounding box
        cv2.rectangle(annotated, (x, y), (x+w, y+h), (0, 255, 0), 2)
        # Draw center
        cx, cy = int(nh['x']), int(nh['y'])
        cv2.circle(annotated, (cx, cy), 3, (0, 0, 255), -1)
        # Write pitch label
        pitch_label = nh['pitch']
        cv2.putText(
            annotated,
            pitch_label,
            (x + w + 5, y + h // 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 255),
            1
        )

    return annotated, noteheads


def _pitch_to_midi_approx(pitch: str) -> Optional[int]:
    """Rough MIDI note number from pitch string."""
    note_to_semitone = {
        'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    }

    if not pitch or pitch == "?":
        return None

    # Parse "Bb3" or "C4" etc
    note_name = pitch[:-1] if pitch[-1].isdigit() else pitch
    octave_str = pitch[-1] if pitch[-1].isdigit() else ""

    if not octave_str:
        return None

    octave = int(octave_str)

    # Extract base note
    base_note = note_name[0]
    accidental = 0
    if len(note_name) > 1:
        if note_name[1] == 'b':
            accidental = -1
        elif note_name[1] == '#':
            accidental = 1

    if base_note not in note_to_semitone:
        return None

    semitone = note_to_semitone[base_note]
    midi = 12 * (octave + 1) + semitone + accidental
    return midi


if __name__ == "__main__":
    # Test on spike_p13_Co-SA_0.png (treble clef, Bb major, 4 two-note chords)
    test_treble = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_voicesep/spike_p13_Co-SA_0.png"
    test_bass = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_voicesep/spike_p8_Co-TB_0.png"

    print("\n=== Testing Treble (spike_p13_Co-SA_0.png) ===")
    annotated_treble, noteheads_treble = estimate_pitches(test_treble, clef="treble", key_signature="Bb")

    if noteheads_treble:
        print(f"\nDetected {len(noteheads_treble)} noteheads:")
        # Sort by x position (left to right)
        noteheads_treble.sort(key=lambda nh: nh['x'])
        for i, nh in enumerate(noteheads_treble):
            print(f"  {i}: x={nh['x']:.0f}, y={nh['y']:.0f}, step={nh.get('step')}, pitch={nh.get('pitch')}, midi~{nh.get('midi_approx')}")

        # Save annotated image
        out_path_treble = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_pitch/spike_p13_Co-SA_0_detected.png"
        cv2.imwrite(out_path_treble, annotated_treble)
        print(f"\nSaved annotated image: {out_path_treble}")

    print("\n=== Testing Bass (spike_p8_Co-TB_0.png) ===")
    annotated_bass, noteheads_bass = estimate_pitches(test_bass, clef="bass", key_signature="Bb")

    if noteheads_bass:
        print(f"\nDetected {len(noteheads_bass)} noteheads:")
        noteheads_bass.sort(key=lambda nh: nh['x'])
        for i, nh in enumerate(noteheads_bass):
            print(f"  {i}: x={nh['x']:.0f}, y={nh['y']:.0f}, step={nh.get('step')}, pitch={nh.get('pitch')}, midi~{nh.get('midi_approx')}")

        out_path_bass = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_pitch/spike_p8_Co-TB_0_detected.png"
        cv2.imwrite(out_path_bass, annotated_bass)
        print(f"\nSaved annotated image: {out_path_bass}")
