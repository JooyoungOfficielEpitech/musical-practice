"""MusicXML quality scorer: compare candidate against reference or score standalone quality."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger("omr.validator")

STEP_TO_SEMITONE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


@dataclass
class NoteInfo:
    step: str
    alter: float
    octave: int
    duration: int
    note_type: str
    is_rest: bool = False
    is_unpitched: bool = False


@dataclass
class MeasureInfo:
    number: int
    notes: list[NoteInfo] = field(default_factory=list)


@dataclass
class ScoreInfo:
    key_fifths: Optional[int] = None
    tempo: Optional[float] = None
    tempo_beat_unit: Optional[str] = None
    sound_tempo: Optional[float] = None
    measures: list[MeasureInfo] = field(default_factory=list)

    @property
    def pitched_notes(self) -> list[NoteInfo]:
        return [n for m in self.measures for n in m.notes if not n.is_rest and not n.is_unpitched]

    def pitched_notes_per_measure(self) -> dict[int, list[NoteInfo]]:
        return {m.number: [n for n in m.notes if not n.is_rest and not n.is_unpitched]
                for m in self.measures}


def parse_musicxml(path: str) -> ScoreInfo:
    """Parse a MusicXML file into a ScoreInfo dataclass."""
    tree = ET.parse(path)
    root = tree.getroot()
    score = ScoreInfo()

    parts = root.findall(".//part")
    if not parts:
        return score
    part = parts[0]

    for measure_el in part.findall("measure"):
        m_num = int(measure_el.get("number", "0"))
        measure = MeasureInfo(number=m_num)

        attrs = measure_el.find("attributes")
        if attrs is not None and score.key_fifths is None:
            key_el = attrs.find("key/fifths")
            if key_el is not None:
                score.key_fifths = int(key_el.text)

        for direction in measure_el.findall("direction"):
            metro = direction.find(".//metronome")
            if metro is not None:
                bu = metro.find("beat-unit")
                pm = metro.find("per-minute")
                if bu is not None and pm is not None and score.tempo is None:
                    score.tempo_beat_unit = bu.text.strip()
                    score.tempo = float(pm.text.strip())
            sound = direction.find(".//sound")
            if sound is not None and sound.get("tempo") and score.sound_tempo is None:
                score.sound_tempo = float(sound.get("tempo"))

        for note_el in measure_el.findall("note"):
            if note_el.find("chord") is not None:
                continue
            rest_el = note_el.find("rest")
            unpitched_el = note_el.find("unpitched")
            pitch_el = note_el.find("pitch")

            duration = int(note_el.findtext("duration", "0"))
            note_type = note_el.findtext("type", "")

            if rest_el is not None:
                measure.notes.append(NoteInfo("", 0.0, 0, duration, note_type, is_rest=True))
            elif unpitched_el is not None:
                measure.notes.append(NoteInfo("", 0.0, 0, duration, note_type, is_unpitched=True))
            elif pitch_el is not None:
                step = pitch_el.findtext("step", "C")
                alter = float(pitch_el.findtext("alter", "0"))
                octave = int(pitch_el.findtext("octave", "4"))
                measure.notes.append(NoteInfo(step, alter, octave, duration, note_type))

        score.measures.append(measure)

    return score


def _pitch_to_semitone(step: str, alter: float, octave: int) -> int:
    return (octave + 1) * 12 + STEP_TO_SEMITONE.get(step, 0) + int(alter)


def score_musicxml_pair(ref_path: str, candidate_path: str) -> dict:
    """Score a candidate MusicXML against a reference. Returns score dict 0-100."""
    ref = parse_musicxml(ref_path)
    cand = parse_musicxml(candidate_path)

    scores: dict[str, tuple[float, str]] = {}

    # Key signature match (20 pts)
    if ref.key_fifths is not None and cand.key_fifths is not None:
        match = ref.key_fifths == cand.key_fifths
        scores["key"] = (20.0 if match else 0.0, f"ref={ref.key_fifths} cand={cand.key_fifths}")
    else:
        scores["key"] = (10.0, "missing key in one file")

    # Measure count (20 pts)
    ref_count = len(ref.measures)
    cand_count = len(cand.measures)
    if ref_count == 0:
        scores["measure_count"] = (10.0, "ref has no measures")
    else:
        ratio = min(cand_count, ref_count) / ref_count
        scores["measure_count"] = (ratio * 20.0, f"ref={ref_count} cand={cand_count}")

    # Note count per measure (30 pts)
    ref_npm = ref.pitched_notes_per_measure()
    cand_npm = cand.pitched_notes_per_measure()
    common_measures = set(ref_npm) & set(cand_npm)
    if common_measures:
        diffs = []
        for m_num in common_measures:
            ref_n = len(ref_npm[m_num])
            cand_n = len(cand_npm[m_num])
            diff = abs(ref_n - cand_n) / max(ref_n, 1)
            diffs.append(diff)
        avg_diff = sum(diffs) / len(diffs)
        scores["note_count"] = (max(0.0, (1.0 - avg_diff)) * 30.0, f"avg_diff={avg_diff:.2f}")
    else:
        scores["note_count"] = (0.0, "no common measures")

    # Pitch accuracy (30 pts)
    ref_pitches = [_pitch_to_semitone(n.step, n.alter, n.octave) for n in ref.pitched_notes]
    cand_pitches = [_pitch_to_semitone(n.step, n.alter, n.octave) for n in cand.pitched_notes]
    if ref_pitches and cand_pitches:
        n = min(len(ref_pitches), len(cand_pitches))
        exact = sum(1 for r, c in zip(ref_pitches[:n], cand_pitches[:n]) if r == c)
        accuracy = exact / len(ref_pitches)
        scores["pitch_accuracy"] = (accuracy * 30.0, f"{exact}/{len(ref_pitches)} exact")
    else:
        scores["pitch_accuracy"] = (0.0, "no pitched notes")

    total = sum(s for s, _ in scores.values())
    return {
        "total": round(total, 1),
        "breakdown": {k: {"score": round(s, 1), "detail": d} for k, (s, d) in scores.items()},
        "ref_measures": len(ref.measures),
        "cand_measures": len(cand.measures),
    }
