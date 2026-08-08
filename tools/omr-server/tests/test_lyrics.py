"""Tests for pipeline.lyrics — syllable merging, barline detection, bucketing,
and <lyric> injection into measure elements."""
import xml.etree.ElementTree as ET

import numpy as np
import pytest

from pipeline.lyrics import (
    StaffBand,
    attach_lyrics_for_page,
    attach_syllables_to_measure,
    band_tokens,
    bucket_by_measure,
    detect_barlines,
    is_lyric_token,
    merge_hyphens,
)
from pipeline.vision_ocr import OcrToken, _token_ranges


def tok(text, cx, cy=100.0):
    return OcrToken(text=text, cx=cx, cy=cy, x0=cx - 5, y0=cy - 5, x1=cx + 5, y1=cy + 5)


# ── vision_ocr tokenization ──────────────────────────────────────────────────

class TestTokenRanges:
    def test_hangul_splits_per_syllable(self):
        assert [t for _, _, t in _token_ranges("옛날 옛적")] == ["옛", "날", "옛", "적"]

    def test_latin_words_stay_whole(self):
        assert [t for _, _, t in _token_ranges("Chuck - a")] == ["Chuck", "-", "a"]

    def test_mixed_hangul_latin(self):
        assert [t for _, _, t in _token_ranges("Mmm... 철길")] == ["Mmm...", "철", "길"]


# ── token filtering ──────────────────────────────────────────────────────────

class TestIsLyricToken:
    def test_accepts_words_and_hangul(self):
        assert is_lyric_token("Chuck")
        assert is_lyric_token("옛")
        assert is_lyric_token("Mmm...")

    def test_rejects_dynamics_numbers_punctuation(self):
        assert not is_lyric_token("mf")
        assert not is_lyric_token("12")
        assert not is_lyric_token("4.")
        assert not is_lyric_token("-")
        assert not is_lyric_token("...")


class TestBandTokens:
    def test_keeps_only_tokens_inside_the_band_sorted_by_x(self):
        band = StaffBand(char="Hermes", top=50, bottom=100, band_bottom=140)
        tokens = [
            tok("밖", 10, cy=95),    # inside staff, not band
            tok("안2", 300, cy=120),
            tok("안1", 100, cy=120),
            tok("아래", 100, cy=160),  # below band
        ]
        assert [t.text for t in band_tokens(tokens, band)] == ["안1", "안2"]


# ── hyphen merging ───────────────────────────────────────────────────────────

class TestMergeHyphens:
    def test_hangul_syllables_are_single(self):
        syls = merge_hyphens([tok("옛", 10), tok("날", 20)])
        assert [(s.text, s.syllabic) for s in syls] == [("옛", "single"), ("날", "single")]

    def test_separated_hyphen_builds_begin_end(self):
        syls = merge_hyphens([tok("Chuck", 10), tok("-", 15), tok("a", 20)])
        assert [(s.text, s.syllabic) for s in syls] == [("Chuck", "begin"), ("a", "end")]

    def test_three_syllable_word(self):
        syls = merge_hyphens(
            [tok("A", 10), tok("-", 12), tok("le", 14), tok("-", 16), tok("lu", 18)]
        )
        assert [(s.text, s.syllabic) for s in syls] == [
            ("A", "begin"), ("le", "middle"), ("lu", "end"),
        ]

    def test_glued_trailing_hyphen(self):
        syls = merge_hyphens([tok("Chuck-", 10), tok("a", 20)])
        assert [(s.text, s.syllabic) for s in syls] == [("Chuck", "begin"), ("a", "end")]


# ── barline detection ────────────────────────────────────────────────────────

class TestDetectBarlines:
    def _staff_image(self, barline_xs, w=400, top=20, bottom=60):
        img = np.zeros((100, w), dtype=np.uint8)
        for y in range(top, bottom, 10):  # five staff "lines"
            img[y, :] = 255
        for x in barline_xs:
            img[top:bottom, x] = 255
        # a note stem: vertical but only half the staff height — must be ignored
        img[top + 15 : bottom, 200] = 255
        return img

    def test_finds_full_height_barlines_only(self):
        img = self._staff_image([10, 110, 250, 390])
        xs = detect_barlines(img, 20, 60)
        assert len(xs) == 4
        assert 200 not in xs
        for expect, got in zip([10, 110, 250, 390], xs):
            assert abs(expect - got) <= 1

    def test_empty_when_no_barlines(self):
        img = np.zeros((100, 400), dtype=np.uint8)
        assert detect_barlines(img, 20, 60) == []


# ── bucketing ────────────────────────────────────────────────────────────────

class TestBucketByMeasure:
    def test_assigns_by_x_range(self):
        syls = merge_hyphens([tok("가", 50), tok("나", 150), tok("다", 160)])
        buckets = bucket_by_measure(syls, [0, 100, 200])
        assert [[s.text for s in b] for b in buckets] == [["가"], ["나", "다"]]


# ── injection ────────────────────────────────────────────────────────────────

def measure_xml(notes: str) -> ET.Element:
    return ET.fromstring(f"<measure number=\"1\">{notes}</measure>")


NOTE = "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>"
REST = "<note><rest/><duration>1</duration></note>"
CHORD = "<note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>"
TIE_STOP = (
    "<note><pitch><step>C</step><octave>4</octave></pitch>"
    "<duration>1</duration><tie type=\"stop\"/></note>"
)


class TestAttachSyllables:
    def test_attaches_in_order_skipping_rests_chords_tie_stops(self):
        m = measure_xml(NOTE + REST + CHORD + TIE_STOP + NOTE)
        syls = merge_hyphens([tok("옛", 10), tok("날", 20)])
        assert attach_syllables_to_measure(m, syls) == 2

        lyric_notes = [n for n in m.findall("note") if n.find("lyric") is not None]
        assert len(lyric_notes) == 2
        texts = [n.find("lyric/text").text for n in lyric_notes]
        assert texts == ["옛", "날"]
        # rest/chord/tie-stop untouched
        assert m.findall("note")[1].find("lyric") is None
        assert m.findall("note")[2].find("lyric") is None
        assert m.findall("note")[3].find("lyric") is None

    def test_extra_syllables_are_dropped_not_misassigned(self):
        m = measure_xml(NOTE)
        syls = merge_hyphens([tok("가", 10), tok("나", 20)])
        assert attach_syllables_to_measure(m, syls) == 1
        assert m.find("note/lyric/text").text == "가"

    def test_melisma_extra_notes_stay_bare(self):
        m = measure_xml(NOTE + NOTE + NOTE)
        assert attach_syllables_to_measure(m, merge_hyphens([tok("아", 10)])) == 1


# ── page-level integration (no Vision needed) ────────────────────────────────

class TestAttachLyricsForPage:
    def test_end_to_end_with_synthetic_geometry(self):
        # Page: one staff (y 20-60), lyric band 60-100, barlines at 0/100/200.
        bw = np.zeros((200, 220), dtype=np.uint8)
        for x in (5, 100, 210):
            bw[20:60, x] = 255
        bands = [(StaffBand(char="Hermes", top=20, bottom=60, band_bottom=100), 0)]
        m1 = measure_xml(NOTE)
        m2 = measure_xml(NOTE + NOTE)
        char_sys = {"Hermes": {0: [m1, m2]}}
        tokens = [tok("가", 50, cy=80), tok("나", 120, cy=80), tok("다", 180, cy=80)]

        attached = attach_lyrics_for_page(tokens, bw, bands, char_sys)

        assert attached == 3
        assert m1.find("note/lyric/text").text == "가"
        assert [n.find("lyric/text").text for n in m2.findall("note")] == ["나", "다"]

    def test_barline_mismatch_attaches_nothing(self):
        bw = np.zeros((200, 220), dtype=np.uint8)
        for x in (5, 210):  # only 1 measure detected
            bw[20:60, x] = 255
        bands = [(StaffBand(char="Hermes", top=20, bottom=60, band_bottom=100), 0)]
        m1, m2 = measure_xml(NOTE), measure_xml(NOTE)
        char_sys = {"Hermes": {0: [m1, m2]}}

        attached = attach_lyrics_for_page([tok("가", 50, cy=80)], bw, bands, char_sys)

        assert attached == 0
        assert m1.find("note/lyric") is None

    def test_compound_staff_targets_top_voice(self):
        bw = np.zeros((200, 220), dtype=np.uint8)
        for x in (5, 210):
            bw[20:60, x] = 255
        bands = [(StaffBand(char="Co.SA", top=20, bottom=60, band_bottom=100), 0)]
        m_sop, m_alto = measure_xml(NOTE), measure_xml(NOTE)
        char_sys = {"Soprano": {0: [m_sop]}, "Alto": {0: [m_alto]}}

        attached = attach_lyrics_for_page([tok("가", 50, cy=80)], bw, bands, char_sys)

        assert attached == 1
        assert m_sop.find("note/lyric/text").text == "가"
        assert m_alto.find("note/lyric") is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


class TestMeasureBoundaries:
    def test_merges_double_barlines(self):
        from pipeline.lyrics import merge_close_boundaries
        assert merge_close_boundaries([100, 108, 300, 500, 506]) == [104, 300, 503]

    def test_drops_single_leading_header_segment(self):
        from pipeline.lyrics import measure_boundaries
        bw = np.zeros((100, 700), dtype=np.uint8)
        # system start, start-repeat pair, then 2 measures
        for x in (10, 150, 158, 400, 690):
            bw[20:60, x] = 255
        # header zone 10..154 is extra; expect [154, 400, 690]
        xs = measure_boundaries(bw, 20, 60, 2)
        assert xs is not None and len(xs) == 3
        assert xs[0] > 100

    def test_returns_none_on_unresolvable_mismatch(self):
        from pipeline.lyrics import measure_boundaries
        bw = np.zeros((100, 700), dtype=np.uint8)
        for x in (10, 200, 400, 600, 690):
            bw[20:60, x] = 255
        assert measure_boundaries(bw, 20, 60, 2) is None


class TestRowSelection:
    def test_splits_stacked_lines_and_prefers_hangul(self):
        from pipeline.lyrics import select_lyric_row, split_rows
        english = [tok("Once", 100, cy=70), tok("up", 160, cy=71)]
        korean = [tok("옛", 105, cy=95), tok("날", 165, cy=96)]
        rows = split_rows(english + korean)
        assert len(rows) == 2
        assert [t.text for t in select_lyric_row(rows)] == ["옛", "날"]

    def test_falls_back_to_row_nearest_staff(self):
        from pipeline.lyrics import select_lyric_row, split_rows
        line1 = [tok("Mmm...", 100, cy=70)]
        line2 = [tok("far", 100, cy=110)]
        rows = split_rows(line1 + line2)
        assert [t.text for t in select_lyric_row(rows)] == ["Mmm..."]


class TestSystemConsensus:
    def test_stems_without_cross_staff_agreement_are_rejected(self):
        from pipeline.lyrics import StaffBand, system_boundaries
        bw = np.zeros((300, 800), dtype=np.uint8)
        # Two staves; shared barlines at 20/400/780; a stem only in staff 1 at 250.
        for x in (20, 400, 780):
            bw[20:60, x] = 255
            bw[100:140, x] = 255
        bw[20:60, 250] = 255  # stem in staff 1 only
        bands = [
            StaffBand(char="A", top=20, bottom=60, band_bottom=90),
            StaffBand(char="B", top=100, bottom=140, band_bottom=170),
        ]
        assert system_boundaries(bw, bands) == [20, 400, 780]


class TestChordSymbolFilter:
    def test_chord_symbols_are_not_lyrics(self):
        for chord in ("Db", "Bb7", "F#m", "Cmaj7", "Eb7", "G/B", "Asus4"):
            assert not is_lyric_token(chord), chord

    def test_real_words_survive(self):
        for word in ("Dawn", "Go", "Ah", "먼", "Amen"):
            assert is_lyric_token(word), word
