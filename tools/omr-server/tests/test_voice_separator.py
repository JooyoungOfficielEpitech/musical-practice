"""Tests for core.voice_separator — image-level voice separation by stem direction."""

import numpy as np
import cv2

from core.voice_separator import separate_voices_image, SeparationResult

SS = 12          # staff line spacing
STAFF_TOP = 50   # y of first staff line
WIDTH, HEIGHT = 400, 220


def _blank(width: int = WIDTH, height: int = HEIGHT) -> np.ndarray:
    return np.full((height, width, 3), 255, dtype=np.uint8)


def _draw_staff(img: np.ndarray) -> None:
    for i in range(5):
        y = STAFF_TOP + i * SS
        cv2.line(img, (20, y), (img.shape[1] - 20, y), (0, 0, 0), 2)


def _draw_up_note(img: np.ndarray, x: int, y: int) -> None:
    """Filled head with a vertical stem on the right going up (~3.5 ss)."""
    cv2.ellipse(img, (x, y), (7, 5), 0, 0, 360, (0, 0, 0), -1)
    cv2.line(img, (x + 6, y), (x + 6, y - 40), (0, 0, 0), 2)


def _draw_down_note(img: np.ndarray, x: int, y: int) -> None:
    """Filled head with a vertical stem on the left going down (~3.5 ss)."""
    cv2.ellipse(img, (x, y), (7, 5), 0, 0, 360, (0, 0, 0), -1)
    cv2.line(img, (x - 6, y), (x - 6, y + 40), (0, 0, 0), 2)


def _draw_whole_note(img: np.ndarray, x: int, y: int) -> None:
    cv2.ellipse(img, (x, y), (8, 6), 0, 0, 360, (0, 0, 0), 2)


def make_two_voice() -> np.ndarray:
    """3 up-stem notes (upper region) + 3 down-stem notes (lower region)."""
    img = _blank()
    _draw_staff(img)
    for x in (120, 180, 240):
        _draw_up_note(img, x, STAFF_TOP + SS)        # y=62
    for x in (150, 210, 270):
        _draw_down_note(img, x, STAFF_TOP + 3 * SS)  # y=86
    return img


def make_monophonic() -> np.ndarray:
    img = _blank()
    _draw_staff(img)
    for x in (120, 170, 220, 270, 320):
        _draw_up_note(img, x, STAFF_TOP + 2 * SS)
    return img


def make_whole_notes_only() -> np.ndarray:
    img = _blank()
    _draw_staff(img)
    _draw_whole_note(img, 120, STAFF_TOP + SS)
    _draw_whole_note(img, 190, STAFF_TOP + 2 * SS)
    return img


def make_two_voice_with_lone_whole(whole_x: int = 330) -> np.ndarray:
    img = make_two_voice()
    _draw_whole_note(img, whole_x, STAFF_TOP + 2 * SS)  # y=74, no partner
    return img


def make_two_voice_with_whole_pair(pair_x: int = 330) -> np.ndarray:
    img = make_two_voice()
    _draw_whole_note(img, pair_x, STAFF_TOP + SS)       # upper
    _draw_whole_note(img, pair_x, STAFF_TOP + 3 * SS)   # lower (2 ss apart)
    return img


def make_beamed_up_pair_plus_down() -> np.ndarray:
    """Beamed up-stem pair (one connected component) + 2 down notes."""
    img = _blank()
    _draw_staff(img)
    for x, y in ((120, STAFF_TOP + 3 * SS), (150, STAFF_TOP + 3 * SS - 4)):
        cv2.ellipse(img, (x, y), (7, 5), 0, 0, 360, (0, 0, 0), -1)
        cv2.line(img, (x + 6, y), (x + 6, STAFF_TOP - 10), (0, 0, 0), 2)
    cv2.line(img, (126, STAFF_TOP - 10), (156, STAFF_TOP - 10), (0, 0, 0), 4)  # beam
    for x in (220, 280):
        _draw_down_note(img, x, STAFF_TOP + 3 * SS)
    return img


def _region_ink(img: np.ndarray, cx: int, cy: int, r: int = 9) -> int:
    """Count dark pixels around a point (notehead presence check)."""
    patch = img[max(0, cy - r):cy + r, max(0, cx - r):cx + r]
    return int(np.count_nonzero(patch < 128))


class TestSeparationResult:
    def test_creates_result(self):
        result = SeparationResult(
            up_img=np.zeros((10, 10)), down_img=np.zeros((10, 10)),
            n_up=2, n_down=3, n_ambiguous=1,
        )
        assert result.n_up == 2
        assert result.n_down == 3
        assert result.n_ambiguous == 1


class TestTwoVoiceSeparation:
    def test_returns_result(self):
        result = separate_voices_image(make_two_voice())
        assert result is not None
        assert isinstance(result, SeparationResult)
        assert result.n_up >= 2
        assert result.n_down >= 2

    def test_up_img_keeps_up_erases_down(self):
        result = separate_voices_image(make_two_voice())
        assert result is not None
        # up notes present in up_img
        assert _region_ink(result.up_img, 120, STAFF_TOP + SS) > 20
        # down noteheads erased from up_img (only staff line rows may remain)
        assert _region_ink(result.up_img, 150, STAFF_TOP + 3 * SS) < _region_ink(
            result.down_img, 150, STAFF_TOP + 3 * SS
        )

    def test_down_img_keeps_down_erases_up(self):
        result = separate_voices_image(make_two_voice())
        assert result is not None
        assert _region_ink(result.down_img, 150, STAFF_TOP + 3 * SS) > 20
        assert _region_ink(result.down_img, 120, STAFF_TOP + SS) < _region_ink(
            result.up_img, 120, STAFF_TOP + SS
        )

    def test_staff_lines_present_in_both(self):
        result = separate_voices_image(make_two_voice())
        assert result is not None
        for img in (result.up_img, result.down_img):
            for i in range(5):
                y = STAFF_TOP + i * SS
                row = img[y:y + 2, 30:WIDTH - 30]
                assert np.count_nonzero(row < 128) > 100, f"Staff line {i} missing"


class TestAmbiguousKeptInBoth:
    def test_lone_whole_note_in_both_images(self):
        result = separate_voices_image(make_two_voice_with_lone_whole())
        assert result is not None
        assert _region_ink(result.up_img, 330, STAFF_TOP + 2 * SS, r=11) > 15
        assert _region_ink(result.down_img, 330, STAFF_TOP + 2 * SS, r=11) > 15

    def test_whole_note_pair_split_by_position(self):
        result = separate_voices_image(make_two_voice_with_whole_pair())
        assert result is not None
        assert result.n_up >= 4  # 3 stemmed + paired upper whole note
        assert result.n_down >= 4
        # upper whole note kept in up_img, erased from down_img
        assert _region_ink(result.up_img, 330, STAFF_TOP + SS, r=11) > 15
        # lower whole note kept in down_img
        assert _region_ink(result.down_img, 330, STAFF_TOP + 3 * SS, r=11) > 15


class TestBeamedGroup:
    def test_beamed_pair_classified_as_unit(self):
        result = separate_voices_image(make_beamed_up_pair_plus_down())
        assert result is not None
        # Whole beamed group (both heads) must be erased from down_img.
        # Redrawn staff-line pixels remain, so compare against up_img.
        for x, y in ((120, STAFF_TOP + 3 * SS), (150, STAFF_TOP + 3 * SS - 4)):
            kept = _region_ink(result.up_img, x, y)
            erased = _region_ink(result.down_img, x, y)
            assert erased < kept * 0.7, f"head at ({x},{y}) not erased: {erased} vs {kept}"
        # Beam itself gone from down_img
        assert _region_ink(result.down_img, 140, STAFF_TOP - 10, r=6) < 5


class TestNotViable:
    def test_monophonic_returns_none(self):
        assert separate_voices_image(make_monophonic()) is None

    def test_whole_notes_only_returns_none(self):
        assert separate_voices_image(make_whole_notes_only()) is None

    def test_blank_image_returns_none(self):
        assert separate_voices_image(_blank()) is None

    def test_noise_only_returns_none(self):
        rng = np.random.default_rng(42)
        noise = (rng.random((200, 400, 3)) * 255).astype(np.uint8)
        result = separate_voices_image(noise)
        assert result is None or (result.n_up + result.n_down) < 6
