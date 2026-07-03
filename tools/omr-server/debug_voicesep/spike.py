"""
Voice separation spike: separate shared staves by stem direction.

Given a crop with two voices (stems up + stems down), produce two separate images.
Algorithm:
1. Binarize
2. Detect staff lines (preserve for output)
3. Find stems (vertical strokes via morphology)
4. Find noteheads (connected components/blobs)
5. Classify each notehead by stem direction
6. Grow regions: for each classified notehead, grow a region to include attached stems and beams
7. Reconstruct two images with staff lines + grown regions
"""

import cv2
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def binarize(img):
    """Convert to grayscale and binarize (stems/noteheads black = 255)."""
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()
    # Invert so black music notation becomes 255
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return binary


def detect_staff_lines(binary):
    """Detect staff line rows using horizontal morphological opening."""
    h, w = binary.shape
    kernel_width = max(w // 4, 100)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_width, 1))
    horiz = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # Find rows that are mostly staff (long horizontal runs)
    row_sums = np.sum(horiz, axis=1) / 255
    threshold = w * 0.15
    staff_rows = (row_sums > threshold).astype(np.uint8)

    # Group into individual lines
    lines = []
    in_line = False
    start = 0
    for i, val in enumerate(staff_rows):
        if val and not in_line:
            start = i
            in_line = True
        elif not val and in_line:
            lines.append((start, i - 1))
            in_line = False
    if in_line:
        lines.append((start, len(staff_rows) - 1))

    # Merge nearby lines
    if not lines:
        return [], []

    merged = [lines[0]]
    for top, bot in lines[1:]:
        prev_top, prev_bot = merged[-1]
        if top - prev_bot <= 3:
            merged[-1] = (prev_top, bot)
        else:
            merged.append((top, bot))

    # Calculate staff spacing
    line_centers = [(t + b) / 2 for t, b in merged]
    gaps = [line_centers[i + 1] - line_centers[i] for i in range(len(line_centers) - 1)]
    staff_spacing = np.median(gaps) if gaps else 10

    return merged, staff_spacing


def remove_staff_lines(binary, lines):
    """Mask out staff lines, keep noteheads and stems."""
    result = binary.copy()
    if not lines:
        return result

    for top, bot in lines:
        margin = int((bot - top + 1) * 1.2)
        y1 = max(0, top - margin)
        y2 = min(result.shape[0], bot + margin + 1)
        result[y1:y2, :] = 0

    return result


def find_stems(binary, staff_spacing):
    """
    Find stems as vertical strokes.
    Stems are roughly staff_spacing tall. Use vertical morphological opening.
    """
    if staff_spacing < 2:
        staff_spacing = 10

    # Create vertical kernel (roughly 2x staff spacing = 1.5-2 spaces)
    kernel_height = int(staff_spacing * 1.8)
    kernel_height = max(3, kernel_height)

    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_height))

    # Morphological opening: keeps vertical structures
    stems = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)

    return stems


def find_noteheads(binary_no_staff, stems, staff_spacing):
    """
    Find noteheads as blobs near stems.
    Strategy: connected components on the original binary, filter by size/shape.
    """
    num_features, labeled = cv2.connectedComponents(binary_no_staff)

    noteheads = []
    for label_id in range(1, num_features + 1):
        mask = (labeled == label_id)
        y, x = np.where(mask)

        if len(y) < 5:  # Too small
            continue

        # Notehead diameter ~= staff spacing (roughly)
        min_y, max_y = y.min(), y.max()
        min_x, max_x = x.min(), x.max()
        h = max_y - min_y + 1
        w = max_x - min_x + 1

        # Noteheads are roughly circular, height ≈ staff_spacing / 1.5
        expected_h = int(staff_spacing / 1.5)
        if abs(h - expected_h) > expected_h * 0.8:
            continue

        # Aspect ratio close to 1 (ellipse)
        aspect = w / h if h > 0 else 0
        if not (0.5 < aspect < 2.0):
            continue

        cy = (min_y + max_y) / 2
        cx = (min_x + max_x) / 2
        noteheads.append({
            'label': label_id,
            'mask': mask,
            'cx': cx,
            'cy': cy,
            'y_min': min_y,
            'y_max': max_y,
            'x_min': min_x,
            'x_max': max_x,
            'h': h,
            'w': w,
        })

    return noteheads


def classify_stem_direction(notehead, stems, staff_lines, staff_spacing):
    """
    Classify notehead as stems-up or stems-down.

    Stems-up: stem is to the RIGHT of notehead center, extends ABOVE
    Stems-down: stem is to the LEFT of notehead center, extends BELOW
    """
    cx, cy = notehead['cx'], notehead['cy']

    # Check for stem on right (extending up from head)
    search_x_right = int(cx + staff_spacing * 0.3)
    search_y_up_start = max(0, int(cy - staff_spacing * 2))
    search_y_up_end = int(cy)

    # Check for stem on left (extending down from head)
    search_x_left = int(cx - staff_spacing * 0.3)
    search_y_down_start = int(cy)
    search_y_down_end = min(stems.shape[0], int(cy + staff_spacing * 2))

    # Count stem pixels in each region
    h, w = stems.shape

    # Right-side up stem
    x_r = min(int(search_x_right), w - 1)
    if x_r >= 0 and search_y_up_start < search_y_up_end:
        region_ru = stems[search_y_up_start:search_y_up_end, max(0, x_r-1):min(w, x_r+2)]
        stem_ru = np.sum(region_ru) / 255 if region_ru.size > 0 else 0
    else:
        stem_ru = 0

    # Left-side down stem
    x_l = max(int(search_x_left), 0)
    if x_l < w and search_y_down_start < search_y_down_end:
        region_ld = stems[search_y_down_start:search_y_down_end, max(0, x_l-1):min(w, x_l+2)]
        stem_ld = np.sum(region_ld) / 255 if region_ld.size > 0 else 0
    else:
        stem_ld = 0

    # Decide
    if stem_ru > stem_ld:
        return 'up'
    elif stem_ld > stem_ru:
        return 'down'
    else:
        # Tie: use heuristic based on vertical center
        staff_center = np.mean([t + b for t, b in staff_lines]) / 2 if staff_lines else cy
        return 'up' if cy < staff_center else 'down'


def reconstruct_voices(binary_no_staff, noteheads, classifications, stems):
    """
    Reconstruct two images: one with up-stem notes, one with down-stem notes.
    Strategy: For each classified notehead, grow a region to capture stems and beams.
    Then assign all ink in the region to that voice.
    """
    h, w = binary_no_staff.shape
    up_voice = np.zeros((h, w), dtype=np.uint8)
    down_voice = np.zeros((h, w), dtype=np.uint8)

    # Create masks for up and down voices based on classification
    up_mask = np.zeros((h, w), dtype=np.uint8)
    down_mask = np.zeros((h, w), dtype=np.uint8)

    for notehead, direction in zip(noteheads, classifications):
        cx, cy = int(notehead['cx']), int(notehead['cy'])
        # Add notehead itself
        up_mask[notehead['mask']] = 1 if direction == 'up' else 0
        down_mask[notehead['mask']] = 1 if direction == 'down' else 0

        # Grow region: add nearby stem pixels and beams
        # Search region: roughly 3 staff-spaces from notehead
        growth_radius = int(notehead['h'] * 3)
        y_min = max(0, cy - growth_radius)
        y_max = min(h, cy + growth_radius)
        x_min = max(0, cx - int(growth_radius * 0.5))
        x_max = min(w, cx + int(growth_radius * 0.5))

        if direction == 'up':
            # Extend upward for stems
            y_max = min(h, cy + int(growth_radius * 0.3))
            y_min = max(0, cy - growth_radius)
            for y in range(y_min, y_max):
                for x in range(x_min, x_max):
                    if stems[y, x] > 0 or binary_no_staff[y, x] > 0:
                        # Distance from notehead center - only include if reasonably close
                        dist_sq = (x - cx) ** 2 + (y - cy) ** 2
                        if dist_sq < (growth_radius ** 2):
                            up_mask[y, x] = 1
        else:
            # Extend downward for stems
            y_min = max(0, cy - int(growth_radius * 0.3))
            y_max = min(h, cy + growth_radius)
            for y in range(y_min, y_max):
                for x in range(x_min, x_max):
                    if stems[y, x] > 0 or binary_no_staff[y, x] > 0:
                        dist_sq = (x - cx) ** 2 + (y - cy) ** 2
                        if dist_sq < (growth_radius ** 2):
                            down_mask[y, x] = 1

    # Now use the masks to assign pixels
    # For pixels in both masks (conflicts), assign to nearest notehead voice
    up_voice[up_mask > 0] = 255
    down_voice[down_mask > 0] = 255

    # Handle conflicts: pixels claimed by both voices go to the closer notehead
    conflict = (up_mask > 0) & (down_mask > 0)
    if np.any(conflict):
        conf_y, conf_x = np.where(conflict)
        for y, x in zip(conf_y, conf_x):
            # Find closest up-classified and down-classified notehead
            min_dist_up = float('inf')
            min_dist_down = float('inf')
            for notehead, direction in zip(noteheads, classifications):
                dist = ((x - notehead['cx']) ** 2 + (y - notehead['cy']) ** 2) ** 0.5
                if direction == 'up' and dist < min_dist_up:
                    min_dist_up = dist
                elif direction == 'down' and dist < min_dist_down:
                    min_dist_down = dist

            if min_dist_up < min_dist_down:
                up_voice[y, x] = 255
                down_voice[y, x] = 0
            else:
                down_voice[y, x] = 255
                up_voice[y, x] = 0

    return up_voice, down_voice


def separate_voices(img_path, output_base):
    """Main pipeline: load image, separate voices, save results."""
    log.info(f"Loading {img_path}")
    img = cv2.imread(img_path)
    if img is None:
        log.error(f"Failed to read {img_path}")
        return None

    # Step 1: Binarize
    binary = binarize(img)
    log.info(f"Binarized: shape {binary.shape}")

    # Step 2: Detect staff lines
    lines, staff_spacing = detect_staff_lines(binary)
    log.info(f"Detected {len(lines)} staff lines, spacing={staff_spacing:.1f}")

    if not lines:
        log.error("No staff lines detected")
        return None

    # Create staff lines image for later inclusion
    staff_lines_img = np.zeros(binary.shape, dtype=np.uint8)
    for top, bot in lines:
        staff_lines_img[top:bot+1, :] = 255

    # Step 3: Remove staff lines
    binary_no_staff = remove_staff_lines(binary, lines)

    # Step 4: Find stems
    stems = find_stems(binary_no_staff, staff_spacing)
    log.info("Found stem structures")

    # Step 5: Find noteheads
    noteheads = find_noteheads(binary_no_staff, stems, staff_spacing)
    log.info(f"Found {len(noteheads)} potential noteheads")

    if len(noteheads) == 0:
        log.error("No noteheads found")
        return None

    # Step 6: Classify by stem direction
    classifications = []
    for notehead in noteheads:
        direction = classify_stem_direction(notehead, stems, lines, staff_spacing)
        classifications.append(direction)

    n_up = sum(1 for c in classifications if c == 'up')
    n_down = sum(1 for c in classifications if c == 'down')
    log.info(f"Classified: {n_up} stems-up, {n_down} stems-down")

    # Step 7: Reconstruct voices
    up_voice, down_voice = reconstruct_voices(binary_no_staff, noteheads, classifications, stems)

    # Add staff lines back to both voices for OMR
    up_with_staff = cv2.bitwise_or(up_voice, staff_lines_img)
    down_with_staff = cv2.bitwise_or(down_voice, staff_lines_img)

    # Save results
    cv2.imwrite(f"{output_base}_up_voice.png", up_with_staff)
    cv2.imwrite(f"{output_base}_down_voice.png", down_with_staff)
    log.info(f"Saved to {output_base}_up_voice.png, {output_base}_down_voice.png")

    # Create annotated debug image
    annotated = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    for notehead, direction in zip(noteheads, classifications):
        cx, cy = int(notehead['cx']), int(notehead['cy'])
        r = int(notehead['h'] / 2 + 2)
        color = (0, 255, 0) if direction == 'up' else (0, 0, 255)  # Green=up, Red=down
        cv2.circle(annotated, (cx, cy), r, color, 2)
        # Draw a tiny arrow indicating stem direction
        if direction == 'up':
            cv2.arrowedLine(annotated, (cx, cy), (cx, cy - r), color, 1)
        else:
            cv2.arrowedLine(annotated, (cx, cy), (cx, cy + r), color, 1)

    cv2.imwrite(f"{output_base}_annotated.png", annotated)
    log.info(f"Saved annotated to {output_base}_annotated.png")

    return {
        'n_stems_up': n_up,
        'n_stems_down': n_down,
        'n_total': len(noteheads),
        'up_voice': up_voice,
        'down_voice': down_voice,
        'binary': binary,
        'binary_no_staff': binary_no_staff,
        'stems': stems,
    }


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
        output_base = sys.argv[2] if len(sys.argv) > 2 else 'output'
        result = separate_voices(img_path, output_base)
        if result:
            print(f"Success: {result['n_stems_up']} up, {result['n_stems_down']} down")
    else:
        print("Usage: python spike.py <input_image> [output_base]")
