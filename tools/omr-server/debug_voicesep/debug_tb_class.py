"""Debug TB classification."""
import cv2
import numpy as np

img = cv2.imread("debug_voicesep/spike_p8_Co-TB_0.png")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

h, w = binary.shape

# Staff detection (same as before)
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

# Remove staff lines
binary_no_staff = binary.copy()
for top, bot in merged:
    margin = int((bot - top + 1) * 1.2)
    y1 = max(0, top - margin)
    y2 = min(binary_no_staff.shape[0], bot + margin + 1)
    binary_no_staff[y1:y2, :] = 0

# Find stems
kernel_height = int(staff_spacing * 1.8)
kernel_height = max(3, kernel_height)
v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_height))
stems = cv2.morphologyEx(binary_no_staff, cv2.MORPH_OPEN, v_kernel)

# Find noteheads
num_features, labeled = cv2.connectedComponents(binary_no_staff)
noteheads = []
for label_id in range(1, num_features + 1):
    mask = labeled == label_id
    y, x = np.where(mask)
    
    if len(y) < 5:
        continue
    
    min_y, max_y = y.min(), y.max()
    min_x, max_x = x.min(), x.max()
    h_comp = max_y - min_y + 1
    w_comp = max_x - min_x + 1
    
    expected_h = int(staff_spacing / 1.5)
    if abs(h_comp - expected_h) > expected_h * 0.8:
        continue
    
    aspect = w_comp / h_comp if h_comp > 0 else 0
    if not (0.5 < aspect < 2.0):
        continue
    
    cy = (min_y + max_y) / 2
    cx = (min_x + max_x) / 2
    noteheads.append({
        "cx": cx, "cy": cy, "y_min": min_y, "y_max": max_y,
        "x_min": min_x, "x_max": max_x
    })

print(f"Found {len(noteheads)} noteheads")
print(f"Staff spacing: {staff_spacing:.1f}")
print(f"Merged lines: {len(merged)}")

# Classify
classifications = []
for notehead in noteheads:
    cx, cy = notehead["cx"], notehead["cy"]
    search_x_right = int(cx + staff_spacing * 0.3)
    search_y_up_start = max(0, int(cy - staff_spacing * 2))
    search_y_up_end = int(cy)
    search_x_left = int(cx - staff_spacing * 0.3)
    search_y_down_start = int(cy)
    search_y_down_end = min(stems.shape[0], int(cy + staff_spacing * 2))
    
    h_s, w_s = stems.shape
    x_r = min(int(search_x_right), w_s - 1)
    if x_r >= 0 and search_y_up_start < search_y_up_end:
        region_ru = stems[search_y_up_start:search_y_up_end, max(0, x_r - 1) : min(w_s, x_r + 2)]
        stem_ru = np.sum(region_ru) / 255 if region_ru.size > 0 else 0
    else:
        stem_ru = 0
    
    x_l = max(int(search_x_left), 0)
    if x_l < w_s and search_y_down_start < search_y_down_end:
        region_ld = stems[search_y_down_start:search_y_down_end, max(0, x_l - 1) : min(w_s, x_l + 2)]
        stem_ld = np.sum(region_ld) / 255 if region_ld.size > 0 else 0
    else:
        stem_ld = 0
    
    if stem_ru > stem_ld:
        direction = "up"
    elif stem_ld > stem_ru:
        direction = "down"
    else:
        staff_center = np.mean([t + b for t, b in merged]) / 2 if merged else cy
        direction = "up" if cy < staff_center else "down"
    
    classifications.append(direction)
    
    if len(classifications) <= 5:
        print(f"  Notehead {len(classifications)}: cy={cy:.1f}, stem_ru={stem_ru:.0f}, stem_ld={stem_ld:.0f} → {direction}")

n_up = sum(1 for c in classifications if c == "up")
n_down = sum(1 for c in classifications if c == "down")
print(f"\nTotal: {n_up} up, {n_down} down")

# Check staff center
staff_center = np.mean([t + b for t, b in merged]) / 2
print(f"Staff center y={staff_center:.1f}")
