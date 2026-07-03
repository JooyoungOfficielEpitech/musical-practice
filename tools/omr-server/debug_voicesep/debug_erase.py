"""Debug why homr gets identical notes from both erase images."""

import cv2
import numpy as np

orig = cv2.imread("debug_voicesep/spike_p8_Co-TB_0.png")
gray = cv2.cvtColor(orig, cv2.COLOR_BGR2GRAY)

up_base = cv2.imread("debug_voicesep/hyp2_spike_p8_Co-TB_0_up_base.png", cv2.IMREAD_GRAYSCALE)
down_base = cv2.imread("debug_voicesep/hyp2_spike_p8_Co-TB_0_down_base.png", cv2.IMREAD_GRAYSCALE)

# Count differences
up_diff = np.sum(np.abs(up_base.astype(int) - gray.astype(int)))
down_diff = np.sum(np.abs(down_base.astype(int) - gray.astype(int)))

print(f"Original shape: {gray.shape}")
print(f"Up erased pixels diff: {up_diff}")
print(f"Down erased pixels diff: {down_diff}")

# Find white (255) pixels in each
up_white = np.sum(up_base == 255)
down_white = np.sum(down_base == 255)
print(f"Up white pixels: {up_white}")
print(f"Down white pixels: {down_white}")

# Check if staff lines are intact in both
print("\nStaff line preservation check:")
print(f"Row 20 in original: {np.sum(gray[20] < 128)} dark pixels")
print(f"Row 20 in up: {np.sum(up_base[20] < 128)} dark pixels")
print(f"Row 20 in down: {np.sum(down_base[20] < 128)} dark pixels")
