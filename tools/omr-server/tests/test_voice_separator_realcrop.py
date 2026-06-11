"""Real-crop regression tests for voice separation viability decisions.

The 4 reference crops (Hadestown Co.SA / Co.TB staves) contain chord-style
choral writing — S+A / T+B written as chords on shared stems — plus rests and
a clap-rhythm line. They contain NO sustained opposing-stem two-voice
texture, so the correct separator decision for every one of them is None:
the merged homr + chord-split fallback path handles chord-style writing.

A regression that force-classifies barlines, time signatures, lyrics or a
neighbouring staff's content as voice material would flip these to non-None
(that bug shipped once — these tests pin the fix).
"""

import os

import cv2
import pytest

from core.voice_separator import separate_voices_image

CROP_DIR = os.path.join(os.path.dirname(__file__), "..", "debug_voicesep")

CROPS = [
    "spike_p1_Co-SA_0.png",   # rests + one tied whole note
    "spike_p8_Co-SA_0.png",   # clap line + shared chords
    "spike_p8_Co-TB_0.png",   # beamed pair + shared chords
    "spike_p13_Co-SA_0.png",  # whole/half-note chords
]


def _load(name):
    path = os.path.join(CROP_DIR, name)
    if not os.path.exists(path):
        pytest.skip(f"reference crop not available: {name}")
    return cv2.imread(path)


@pytest.mark.parametrize("crop_name", CROPS)
def test_chord_style_crops_take_fallback_path(crop_name):
    img = _load(crop_name)
    result = separate_voices_image(img)
    assert result is None, (
        f"{crop_name}: chord-style writing should NOT separate — "
        f"got up={result.n_up} down={result.n_down}"
    )
