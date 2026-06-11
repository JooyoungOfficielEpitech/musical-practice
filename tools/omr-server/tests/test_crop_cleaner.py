"""Tests for core.crop_cleaner — strip out-of-staff contamination from crops."""

import numpy as np
import cv2

from core.crop_cleaner import strip_outside_staff

SS = 12
STAFF_TOP = 60
WIDTH, HEIGHT = 400, 180


def _blank() -> np.ndarray:
    return np.full((HEIGHT, WIDTH, 3), 255, dtype=np.uint8)


def _draw_staff(img: np.ndarray) -> None:
    for i in range(5):
        y = STAFF_TOP + i * SS
        cv2.line(img, (20, y), (WIDTH - 20, y), (0, 0, 0), 2)


def _draw_note(img: np.ndarray, x: int, y: int, stem_to: int) -> None:
    cv2.ellipse(img, (x, y), (7, 5), 0, 0, 360, (0, 0, 0), -1)
    cv2.line(img, (x + 6, y), (x + 6, stem_to), (0, 0, 0), 2)


def _draw_x(img: np.ndarray, x: int, y: int, r: int = 6) -> None:
    cv2.line(img, (x - r, y - r), (x + r, y + r), (0, 0, 0), 2)
    cv2.line(img, (x + r, y - r), (x - r, y + r), (0, 0, 0), 2)


def _ink(img: np.ndarray, cx: int, cy: int, r: int = 10) -> int:
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    patch = g[max(0, cy - r):cy + r, max(0, cx - r):cx + r]
    return int(np.count_nonzero(patch < 128))


STAFF_BOT = STAFF_TOP + 4 * SS  # 108


class TestStripOutsideStaff:
    def test_clap_line_above_staff_erased(self):
        img = _blank()
        _draw_staff(img)
        _draw_note(img, 100, STAFF_TOP + 2 * SS, STAFF_TOP - 10)
        _draw_x(img, 200, STAFF_TOP - 3 * SS)  # clap head well above staff
        out = strip_outside_staff(img)
        assert _ink(out, 200, STAFF_TOP - 3 * SS) == 0
        # real note untouched
        assert _ink(out, 100, STAFF_TOP + 2 * SS) > 20

    def test_below_staff_bleed_erased(self):
        img = _blank()
        _draw_staff(img)
        _draw_note(img, 100, STAFF_TOP + 2 * SS, STAFF_TOP - 10)
        # neighbor-staff rest blob far below
        cv2.rectangle(img, (250, STAFF_BOT + int(3.5 * SS)), (262, STAFF_BOT + int(3.5 * SS) + 8), (0, 0, 0), -1)
        out = strip_outside_staff(img)
        assert _ink(out, 256, STAFF_BOT + int(3.5 * SS) + 4) == 0

    def test_ledger_note_above_staff_kept(self):
        img = _blank()
        _draw_staff(img)
        _draw_note(img, 100, STAFF_TOP + 2 * SS, STAFF_TOP - 10)
        # high note one ledger above, stem reaching down into the staff
        _draw_note(img, 300, STAFF_TOP - SS, STAFF_TOP + SS)
        out = strip_outside_staff(img)
        assert _ink(out, 300, STAFF_TOP - SS) > 20

    def test_down_stem_below_staff_kept(self):
        img = _blank()
        _draw_staff(img)
        # head on bottom line, stem hanging 3.5ss below staff
        cv2.ellipse(img, (150, STAFF_BOT), (7, 5), 0, 0, 360, (0, 0, 0), -1)
        cv2.line(img, (144, STAFF_BOT), (144, STAFF_BOT + 42), (0, 0, 0), 2)
        out = strip_outside_staff(img)
        assert _ink(out, 150, STAFF_BOT) > 20
        assert _ink(out, 144, STAFF_BOT + 35, r=5) > 5  # stem tail survives

    def test_clap_with_stem_touching_staff_erased(self):
        img = _blank()
        _draw_staff(img)
        _draw_note(img, 100, STAFF_TOP + 2 * SS, STAFF_TOP - 10)
        # clap x-head above staff whose stem reaches DOWN onto the top line
        _draw_x(img, 250, STAFF_TOP - 2 * SS)
        cv2.line(img, (256, STAFF_TOP - 2 * SS), (256, STAFF_TOP), (0, 0, 0), 2)
        out = strip_outside_staff(img)
        assert _ink(out, 250, STAFF_TOP - 2 * SS) == 0

    def test_in_staff_x_notehead_kept(self):
        # Hermes spoken-rhythm x-noteheads sit ON the staff — must survive
        img = _blank()
        _draw_staff(img)
        _draw_x(img, 180, STAFF_TOP + 2 * SS, r=5)
        out = strip_outside_staff(img)
        assert _ink(out, 180, STAFF_TOP + 2 * SS) > 10

    def test_no_staff_returns_unchanged(self):
        img = _blank()
        _draw_x(img, 200, 50)
        out = strip_outside_staff(img)
        assert np.array_equal(out, cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)) or np.array_equal(out, img)

    def test_input_not_mutated(self):
        img = _blank()
        _draw_staff(img)
        _draw_x(img, 200, STAFF_TOP - 3 * SS)
        before = img.copy()
        strip_outside_staff(img)
        assert np.array_equal(img, before)


class TestRealCrop:
    def test_p8_sa_claps_removed_notes_kept(self):
        import os
        path = os.path.join(os.path.dirname(__file__), "..", "debug_voicesep", "spike_p8_Co-SA_0.png")
        if not os.path.exists(path):
            import pytest
            pytest.skip("reference crop not available")
        img = cv2.imread(path)
        out = strip_outside_staff(img)
        g_in = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # clap line lives at y≈15-50 (staff band 53-101): mostly cleared —
        # anti-alias ghosts of erased glyphs may leave ≤15% residue
        assert np.count_nonzero(out[0:40, :] < 128) < np.count_nonzero(g_in[0:40, :] < 128) * 0.15
        # staff-band ink preserved (>90%)
        band_in = np.count_nonzero(g_in[50:105, :] < 128)
        band_out = np.count_nonzero(out[50:105, :] < 128)
        assert band_out > band_in * 0.9
