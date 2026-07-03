#!/usr/bin/env python3
"""Part B: Clap-line contamination analysis.

The spike_p8_Co-SA_0.png image shows x-notehead symbols (clap rhythm) ABOVE
the staff that get converted to filled heads and misread as high soprano notes (G5, MIDI 79).

Analysis:
1. Load spike_p8_Co-SA_0.png and measure the exact y-geometry of:
   - Clap heads (x-notehead region)
   - Staff band (staff_top, staff_bottom, staff_spacing)
2. Check 2-3 other pages' Co.SA crops (pages 8-14) for:
   - Where clap lines appear (y-positions)
   - Where real ledger-line notes appear (high soprano)
3. Propose a safe geometric rule to erase claps without harming real notes

Evidence-based output:
- Y-distributions for clap heads vs staff
- Y-distributions for real high notes vs staff
- Safe erase rule recommendation
"""

import sys
import json
from pathlib import Path
from typing import NamedTuple

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.staff_detector import (
    _binarize, _detect_staff_line_rows, _group_into_staves,
    _group_staff_lines, _to_gray
)


class StaffGeometry(NamedTuple):
    """Extracted staff geometry."""
    staff_top: int
    staff_bottom: int
    staff_spacing: float  # pixels per line space
    num_lines: int


class InkRegion(NamedTuple):
    """A detected ink region."""
    y_min: int
    y_max: int
    y_center: int
    height: int
    x_min: int
    x_max: int
    is_x_shaped: bool  # True if appears to be x-notehead
    label: str  # 'clap' or 'note' (determined by y-position)


def read_image(path: str) -> np.ndarray:
    """Read image as BGR."""
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot read {path}")
    return img


def extract_staff_geometry(img: np.ndarray) -> StaffGeometry | None:
    """Extract staff geometry from image."""
    gray = _to_gray(img)
    bw = _binarize(gray)

    row_mask = _detect_staff_line_rows(bw)
    line_groups = _group_staff_lines(row_mask, min_line_gap=3)

    if len(line_groups) < 4:
        print("WARNING: Fewer than 4 staff lines detected")
        return None

    staff_top = line_groups[0][0]
    staff_bottom = line_groups[-1][1]

    # Calculate staff spacing as median distance between consecutive lines
    centers = [(t + b) // 2 for t, b in line_groups]
    spacings = [centers[i+1] - centers[i] for i in range(len(centers) - 1)]
    staff_spacing = float(np.median(spacings))

    return StaffGeometry(
        staff_top=staff_top,
        staff_bottom=staff_bottom,
        staff_spacing=staff_spacing,
        num_lines=len(line_groups)
    )


def detect_ink_regions(img: np.ndarray, staff_geom: StaffGeometry) -> list[InkRegion]:
    """Detect distinct ink regions (noteheads, claps, etc.) in the image.

    Use contour detection to find closed shapes above, within, and below staff.
    """
    gray = _to_gray(img)
    bw = _binarize(gray)

    # Find contours
    contours, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    for contour in contours:
        area = cv2.contourArea(contour)
        # Filter: only regions roughly notehead-sized (50-500 pixels)
        if area < 50 or area > 500:
            continue

        x, y, w, h = cv2.boundingRect(contour)
        y_center = y + h // 2

        # Classify by position relative to staff
        if y_center < staff_geom.staff_top:
            label = 'above_staff'
        elif y_center > staff_geom.staff_bottom:
            label = 'below_staff'
        else:
            label = 'on_staff'

        # Check if it's x-shaped
        # Simple heuristic: compute aspect ratio and circularity
        circularity = 4 * np.pi * area / (cv2.arcLength(contour, True) ** 2) if cv2.arcLength(contour, True) > 0 else 0
        is_x_shaped = circularity < 0.6  # X-shapes have lower circularity than circles

        regions.append(InkRegion(
            y_min=y,
            y_max=y + h,
            y_center=y_center,
            height=h,
            x_min=x,
            x_max=x + w,
            is_x_shaped=is_x_shaped,
            label=label
        ))

    return sorted(regions, key=lambda r: r.y_center)


def analyze_page_8_clap_contamination():
    """Analyze the known clap-line spike on page 8."""
    spike_path = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_voicesep/spike_p8_Co-SA_0.png"
    if not Path(spike_path).exists():
        print(f"ERROR: {spike_path} not found")
        return None

    print("=" * 80)
    print("ANALYZING PAGE 8 CLAP-LINE SPIKE")
    print("=" * 80)

    img = read_image(spike_path)
    geom = extract_staff_geometry(img)

    if geom is None:
        print("ERROR: Could not extract staff geometry")
        return None

    print(f"\nStaff geometry:")
    print(f"  Staff top: {geom.staff_top} px")
    print(f"  Staff bottom: {geom.staff_bottom} px")
    print(f"  Staff height: {geom.staff_bottom - geom.staff_top} px")
    print(f"  Staff spacing: {geom.staff_spacing:.1f} px/line")

    regions = detect_ink_regions(img, geom)

    print(f"\nDetected {len(regions)} ink regions:")
    above_staff = [r for r in regions if r.label == 'above_staff']
    on_staff = [r for r in regions if r.label == 'on_staff']
    below_staff = [r for r in regions if r.label == 'below_staff']

    print(f"\n  Above staff ({len(above_staff)} regions):")
    for r in above_staff:
        above_top_dist = geom.staff_top - r.y_max
        print(f"    y={r.y_center:3d} (height={r.height:2d}, x_shaped={r.is_x_shaped}, dist_above_top={above_top_dist:3d}px)")

    print(f"\n  On staff ({len(on_staff)} regions):")
    for r in on_staff:
        rel_pos = (r.y_center - geom.staff_top) / (geom.staff_bottom - geom.staff_top)
        print(f"    y={r.y_center:3d} (height={r.height:2d}, x_shaped={r.is_x_shaped}, rel_pos={rel_pos:.2f})")

    print(f"\n  Below staff ({len(below_staff)} regions):")
    for r in below_staff:
        below_bottom_dist = r.y_min - geom.staff_bottom
        print(f"    y={r.y_center:3d} (height={r.height:2d}, x_shaped={r.is_x_shaped}, dist_below_bottom={below_bottom_dist:3d}px)")

    # Visualize
    output_img = img.copy()
    # Draw staff bounds in green
    cv2.line(output_img, (0, geom.staff_top), (img.shape[1], geom.staff_top), (0, 255, 0), 2)
    cv2.line(output_img, (0, geom.staff_bottom), (img.shape[1], geom.staff_bottom), (0, 255, 0), 2)

    # Draw detected regions: red for above, blue for on, yellow for below
    for r in above_staff:
        color = (0, 0, 255)  # Red
        cv2.rectangle(output_img, (r.x_min, r.y_min), (r.x_max, r.y_max), color, 2)
        cv2.putText(output_img, f"A{r.y_center}", (r.x_min, r.y_min - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color)

    for r in on_staff:
        color = (255, 0, 0)  # Blue
        cv2.rectangle(output_img, (r.x_min, r.y_min), (r.x_max, r.y_max), color, 2)

    for r in below_staff:
        color = (0, 255, 255)  # Yellow
        cv2.rectangle(output_img, (r.x_min, r.y_min), (r.x_max, r.y_max), color, 2)

    out_path = Path("/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_pitch") / "p8_clap_annotated.png"
    cv2.imwrite(str(out_path), output_img)
    print(f"\nAnnotated image saved: {out_path}")

    return {
        'page': 8,
        'geometry': {
            'staff_top': geom.staff_top,
            'staff_bottom': geom.staff_bottom,
            'staff_spacing': geom.staff_spacing,
        },
        'regions_above': [(r.y_center, r.height, r.is_x_shaped) for r in above_staff],
        'regions_on': [(r.y_center, r.height, r.is_x_shaped) for r in on_staff],
        'regions_below': [(r.y_center, r.height, r.is_x_shaped) for r in below_staff],
    }


def check_other_pages():
    """Check pages 8-14 for clap patterns and ledger-line notes."""
    pages = [8, 9, 10, 11, 12, 13, 14]
    ref_dir = Path("/Users/mmecoco/Desktop/musical-practice/tools/omr-server/reference")

    print("\n" + "=" * 80)
    print("CHECKING OTHER PAGES FOR CLAP LINES AND LEDGER NOTES")
    print("=" * 80)

    results = {}

    for page_num in pages:
        # Construct filename like "하데스타운 악보 통합본-008.png"
        fname = f"하데스타운 악보 통합본-{page_num:03d}.png"
        fpath = ref_dir / fname

        if not fpath.exists():
            print(f"\nPage {page_num}: FILE NOT FOUND ({fname})")
            continue

        print(f"\nPage {page_num}: Analyzing {fname}...")

        try:
            img = read_image(str(fpath))
            geom = extract_staff_geometry(img)

            if geom is None:
                print(f"  Could not extract geometry")
                continue

            regions = detect_ink_regions(img, geom)
            above = [r for r in regions if r.label == 'above_staff']
            on = [r for r in regions if r.label == 'on_staff']
            below = [r for r in regions if r.label == 'below_staff']

            print(f"  Staff: y={geom.staff_top}-{geom.staff_bottom} (spacing={geom.staff_spacing:.1f}px)")
            print(f"  Regions: {len(above)} above, {len(on)} on, {len(below)} below")

            if above:
                x_shaped = sum(1 for r in above if r.is_x_shaped)
                print(f"    Above staff: {len(above)} regions, {x_shaped} x-shaped")
                for r in above[:3]:  # Show first 3
                    print(f"      y={r.y_center}, height={r.height}")

            results[page_num] = {
                'staff_top': geom.staff_top,
                'staff_bottom': geom.staff_bottom,
                'staff_spacing': geom.staff_spacing,
                'above_count': len(above),
                'above_x_shaped': sum(1 for r in above if r.is_x_shaped),
                'above_y_centers': [r.y_center for r in above],
                'on_count': len(on),
                'below_count': len(below),
            }

        except Exception as e:
            print(f"  Error: {e}")

    return results


def propose_safe_erase_rule(p8_data: dict, other_pages: dict) -> str:
    """Propose a safe geometric rule based on evidence."""
    print("\n" + "=" * 80)
    print("SAFE ERASE RULE ANALYSIS")
    print("=" * 80)

    if not p8_data:
        return "ERROR: No page 8 data"

    staff_top = p8_data['geometry']['staff_top']
    staff_spacing = p8_data['geometry']['staff_spacing']

    above_ys = [y for y, h, is_x in p8_data['regions_above']]
    on_ys = [y for y, h, is_x in p8_data['regions_on']]

    if not above_ys:
        return "No clap lines detected; rule not needed"

    clap_max_y = max(above_ys)
    clap_min_y = min(above_ys)

    print(f"\nClap line y-range: {clap_min_y}-{clap_max_y}")
    print(f"Staff top: {staff_top}")
    print(f"Clap lines are {staff_top - clap_max_y}px to {staff_top - clap_min_y}px above staff top")

    print(f"\nNote y-range (on staff): {min(on_ys) if on_ys else 'N/A'}-{max(on_ys) if on_ys else 'N/A'}")

    # Propose rule
    margin_above_claps = staff_top - clap_min_y - 10  # 10px safety buffer
    rule = f"Erase all ink with y < (staff_top - {margin_above_claps}px)"

    print(f"\nPROPOSED RULE:")
    print(f"  {rule}")
    print(f"\nRATIONALE:")
    print(f"  - Clap lines appear {staff_top - clap_max_y}px above staff top")
    print(f"  - Real high soprano notes (ledger lines) appear within/near staff region")
    print(f"  - Safe margin: erase only ink well above staff top")

    # Check if rule would harm real notes
    harm_count = sum(1 for y in on_ys if y < (staff_top - margin_above_claps))
    if harm_count > 0:
        print(f"\n  WARNING: This rule would erase {harm_count} on-staff regions!")
        # Refine
        safe_margin = min((staff_top - y) for y in on_ys) // 2
        rule = f"Erase all ink with y < (staff_top - {safe_margin}px)"
        print(f"  REFINED RULE: {rule}")

    return rule


def main():
    output_dir = Path("/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_pitch")
    output_dir.mkdir(exist_ok=True)

    # Part B: Page 8 clap analysis
    p8_data = analyze_page_8_clap_contamination()

    # Check other pages
    other_data = check_other_pages()

    # Propose rule
    rule = propose_safe_erase_rule(p8_data, other_data)

    # Save results
    results = {
        'page_8_spike': p8_data,
        'other_pages': other_data,
        'proposed_rule': rule,
    }

    results_json = output_dir / "part_b_results.json"
    with open(results_json, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n\nResults saved to {results_json}")

    print("\n" + "=" * 80)
    print("CONCLUSION")
    print("=" * 80)
    print(rule)


if __name__ == '__main__':
    main()
