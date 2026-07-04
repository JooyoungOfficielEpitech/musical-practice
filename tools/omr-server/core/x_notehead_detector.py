"""Improved x-notehead detector using contour morphology and shape analysis."""

import logging
from typing import Optional

import cv2
import numpy as np

log = logging.getLogger("x_notehead_detector")


def _find_crossing_ratio(contour: np.ndarray) -> float:
    """Estimate how 'X-like' a contour is by analyzing its crossing pattern.

    An X-notehead consists of two diagonal strokes crossing at roughly 45 degrees.
    A quarter notehead is a filled ellipse with no interior crossings.

    Heuristic: X-heads have lower solidity (two lines) and higher aspect ratio variance.

    Returns:
        Crossing ratio (0-1, higher = more X-like)
    """
    if len(contour) < 5:
        return 0.0

    # Compute hull to get outer boundary
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    contour_area = cv2.contourArea(contour)

    if hull_area == 0:
        return 0.0

    # For X-head (two crossing lines), solidity is much lower
    # For filled notehead (ellipse), solidity is higher
    solidity = contour_area / hull_area if hull_area > 0 else 0.0

    # Fit bounding rect to check aspect ratio
    x, y, w, h = cv2.boundingRect(contour)
    if w == 0 or h == 0:
        return 0.0

    aspect = max(w, h) / min(w, h) if min(w, h) > 0 else 1.0

    # X-heads tend to be roughly square (aspect ~1-1.5), not elongated
    # Filled noteheads are also roughly square
    # But X-heads have much lower fill (solidity < 0.35)
    # Filled noteheads have high fill (solidity > 0.5)

    # Very low solidity + reasonable aspect = likely X-head
    if solidity < 0.35 and aspect < 2.0:
        # Score based on solidity: lower is better for X detection
        crossing_score = (0.35 - solidity) / 0.35
        return min(crossing_score, 1.0)

    return 0.0


def detect_x_noteheads_contour(
    binary: np.ndarray,
    staff_mask: Optional[np.ndarray] = None,
    size_range: tuple[int, int] = (8, 24),
) -> list[tuple[int, int, float]]:
    """Detect X-noteheads using contour analysis.

    Args:
        binary: Binary image (white noteheads on black background, inverted)
        staff_mask: Optional mask (255 in staff regions, 0 elsewhere)
        size_range: (min_size, max_size) in pixels

    Returns:
        List of (cx, cy, score) for detected x-noteheads
    """
    min_size, max_size = size_range

    # Find contours
    contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    detections = []

    for contour in contours:
        area = cv2.contourArea(contour)

        # Filter by size: typical notehead is 10-20px diameter
        if area < min_size * min_size or area > max_size * max_size:
            continue

        # Compute moments for center
        M = cv2.moments(contour)
        if M["m00"] == 0:
            continue
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])

        # Check staff mask if provided
        if staff_mask is not None:
            if cy >= staff_mask.shape[0] or cx >= staff_mask.shape[1]:
                continue
            if staff_mask[cy, cx] == 0:
                continue

        # Analyze shape: X-head has lower solidity (two crossing lines)
        crossing_score = _find_crossing_ratio(contour)

        # X-heads should have high crossing_score (low solidity = two crossing lines)
        # Filled noteheads will have low crossing_score (high solidity = filled ellipse)
        if crossing_score > 0.5:
            detections.append((cx, cy, crossing_score))

    return detections


def cluster_detections(
    detections: list[tuple[int, int, float]],
    nms_threshold: int = 12,
) -> list[tuple[int, int, float]]:
    """Cluster nearby detections, keeping the highest-scoring one in each cluster.

    Args:
        detections: List of (cx, cy, score)
        nms_threshold: Distance threshold for clustering

    Returns:
        Clustered detections
    """
    if not detections:
        return []

    # Sort by score descending
    sorted_dets = sorted(detections, key=lambda x: -x[2])
    kept = []

    for cx, cy, score in sorted_dets:
        # Check if too close to any kept detection
        if not any(
            abs(cx - kx) < nms_threshold and abs(cy - ky) < nms_threshold
            for kx, ky, _ in kept
        ):
            kept.append((cx, cy, score))

    return kept
