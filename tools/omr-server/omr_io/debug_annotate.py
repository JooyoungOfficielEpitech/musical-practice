"""Debug visualization: annotate sheet music images with detected staff regions."""

import logging
import os

import cv2

from core.staff_detector import (
    _binarize,
    _detect_staff_line_rows,
    _find_staff_start_x,
    _group_into_staves,
    _group_staff_lines,
    _group_staves_into_systems,
    _to_gray,
)

log = logging.getLogger("omr.debug_annotate")

# Colour palette for system annotations (BGR)
SYSTEM_COLORS = [
    (255, 100, 100),
    (100, 255, 100),
    (100, 100, 255),
    (255, 255, 100),
    (255, 100, 255),
    (100, 255, 255),
]


def annotate_page(image_path: str, output_path: str) -> None:
    """Annotate a sheet music image with detected staves and systems.

    Draws colored bounding boxes around each system and labels each staff.
    Writes the annotated image to output_path.
    """
    img = cv2.imread(image_path)
    if img is None:
        log.error(f"Could not read image: {image_path}")
        return

    gray = _to_gray(img)
    bw = _binarize(gray)
    h, w = gray.shape

    row_mask = _detect_staff_line_rows(bw)
    lines = _group_staff_lines(row_mask)
    staves = _group_into_staves(lines, h)
    systems = _group_staves_into_systems(staves, h, bw=bw)
    staff_start_x = _find_staff_start_x(bw)

    annotated = img.copy()

    for sys_idx, system in enumerate(systems):
        color = SYSTEM_COLORS[sys_idx % len(SYSTEM_COLORS)]

        # Draw system bounding box
        top_staff = staves[system[0]]
        bot_staff = staves[system[-1]]
        sys_top = top_staff[0][0]
        sys_bot = bot_staff[-1][1]
        cv2.rectangle(annotated, (0, sys_top - 5), (w - 1, sys_bot + 5), color, 2)
        cv2.putText(
            annotated, f"System {sys_idx + 1}",
            (10, sys_top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2,
        )

        # Label each staff in the system
        for rank, staff_idx in enumerate(system):
            staff = staves[staff_idx]
            staff_top = staff[0][0]
            cv2.line(annotated, (staff_start_x, staff_top), (staff_start_x + 20, staff_top), color, 1)
            cv2.putText(
                annotated, f"S{rank + 1}",
                (staff_start_x + 5, staff_top + 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1,
            )

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    cv2.imwrite(output_path, annotated)
    log.info(f"Annotated image written to {output_path}")
    log.info(f"  {len(staves)} staves in {len(systems)} systems")
