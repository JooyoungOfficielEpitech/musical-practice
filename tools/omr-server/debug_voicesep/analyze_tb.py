"""Analyze why TB fails — check stem classification."""
import cv2
import numpy as np

img = cv2.imread("debug_voicesep/spike_p8_Co-TB_0.png")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

h, w = binary.shape
kernel_width = max(w // 4, 100)
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_width, 1))
horiz = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

row_sums = np.sum(horiz, axis=1) / 255
threshold = w * 0.15
staff_rows = (row_sums > threshold).astype(np.uint8)

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

merged = [lines[0]]
for top, bot in lines[1:]:
    prev_top, prev_bot = merged[-1]
    if top - prev_bot <= 3:
        merged[-1] = (prev_top, bot)
    else:
        merged.append((top, bot))

line_centers = [(t + b) / 2 for t, b in merged]
gaps = [line_centers[i + 1] - line_centers[i] for i in range(len(line_centers) - 1)]
staff_spacing = np.median(gaps) if gaps else 10

print(f"Detected {len(merged)} staff systems")
print(f"Staff spacing: {staff_spacing:.1f}")

# Check if we have 2 separate 5-line systems (one for T, one for B)
# or if it's a grand staff (10 lines total)

print("Line positions:")
for i, (top, bot) in enumerate(merged):
    print(f"  System {i//5 + 1}, Line {i%5 + 1}: rows {top}-{bot}")
