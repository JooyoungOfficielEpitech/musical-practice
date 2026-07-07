"""Conservative homr+Audiveris ensemble at the measure level.

The two engines fail in complementary ways on this repertoire:
- homr: beamed eighths and (with preprocessing) x-noteheads are solid, but it
  halves dotted figures (then pads the measure with a rest) and misses some
  printed accidentals.
- Audiveris: dotted rhythms, printed accidentals and chord octaves are solid,
  but it reads beamed eighths as quarters and garbles x-notehead measures.

So the merge only ever adopts two things from Audiveris, behind hard gates:
1. ALTER adoption — our note has no <alter>, the step-matched Audiveris note
   has one. Never removes an alter.
2. RHYTHM adoption — our measure carries a trailing pad rest (the signature
   of homr misreading durations and our bar-grid filling the gap) while the
   Audiveris measure is duration-exact with the same pitched-note count.

A measure is only considered at all when every pitched note in it step-matches
the Audiveris reading (octave tolerance 1 for 8vb ambiguity), and x-notehead
(unpitched) measures are never touched.
"""

import logging
import xml.etree.ElementTree as ET
from typing import Optional

log = logging.getLogger("omr.ensemble")

BEAT_EPS = 1e-6
MIN_PART_SCORE = 0.5


def _measure_beats(measure: ET.Element, divisions: int) -> list[dict]:
    """Ordered events: {'kind': 'note'|'rest', 'beats', 'notes': [note elems]}.

    Chord notes are grouped with their main note.
    """
    events = []
    for note in measure.findall("note"):
        dur = note.findtext("duration")
        beats = (int(dur) / divisions) if dur and dur.isdigit() else 0.0
        if note.find("chord") is not None and events and events[-1]["kind"] == "note":
            events[-1]["notes"].append(note)
            continue
        kind = "rest" if note.find("rest") is not None else "note"
        events.append({"kind": kind, "beats": beats, "notes": [note]})
    return events


def _part_divisions(part: ET.Element) -> int:
    div = part.findtext(".//attributes/divisions")
    return int(div) if div and div.isdigit() else 4


def _note_sig(note: ET.Element) -> Optional[tuple[str, int, Optional[int]]]:
    p = note.find("pitch")
    if p is None:
        return None
    alter = p.findtext("alter")
    return (
        p.findtext("step") or "?",
        int(p.findtext("octave") or 0),
        int(float(alter)) if alter else None,
    )


def _steps_match(our_events: list[dict], aud_events: list[dict]) -> bool:
    """Every our-note must step-match some note in the paired aud group."""
    our_notes = [e for e in our_events if e["kind"] == "note"]
    aud_notes = [e for e in aud_events if e["kind"] == "note"]
    if len(our_notes) != len(aud_notes) or not our_notes:
        return False
    for oe, ae in zip(our_notes, aud_notes):
        for our_note in oe["notes"]:
            sig = _note_sig(our_note)
            if sig is None:
                return False
            step, octave, _ = sig
            if not any(
                (a := _note_sig(an)) is not None
                and a[0] == step and abs(a[1] - octave) <= 1
                for an in ae["notes"]
            ):
                return False
    return True


def _adopt_alters(our_events: list[dict], aud_events: list[dict]) -> int:
    """Copy explicit Audiveris alters onto step-matched notes lacking one."""
    changed = 0
    our_notes = [e for e in our_events if e["kind"] == "note"]
    aud_notes = [e for e in aud_events if e["kind"] == "note"]
    for oe, ae in zip(our_notes, aud_notes):
        for our_note in oe["notes"]:
            sig = _note_sig(our_note)
            if sig is None or sig[2] is not None:
                continue
            step, octave, _ = sig
            for an in ae["notes"]:
                a = _note_sig(an)
                if a and a[0] == step and abs(a[1] - octave) <= 1 and a[2] is not None:
                    pitch = our_note.find("pitch")
                    alter = ET.Element("alter")
                    alter.text = str(a[2])
                    # <alter> belongs between <step> and <octave>
                    children = list(pitch)
                    idx = next(i for i, c in enumerate(children) if c.tag == "step") + 1
                    pitch.insert(idx, alter)
                    changed += 1
                    break
    return changed


def _adopt_rhythm(
    measure: ET.Element, our_events: list[dict], aud_events: list[dict], divisions: int
) -> bool:
    """Rebuild the measure's timing from Audiveris when homr's is broken.

    Gates: our measure ends in pad rest(s), the Audiveris measure sums to a
    full bar, and pitched counts already matched upstream.
    """
    if not our_events or our_events[-1]["kind"] != "rest":
        return False
    aud_sum = sum(e["beats"] for e in aud_events)
    if abs(aud_sum - 4.0) > BEAT_EPS:
        return False
    our_pitched = [e for e in our_events if e["kind"] == "note"]
    aud_pitched = [e for e in aud_events if e["kind"] == "note"]
    if abs(sum(e["beats"] for e in our_pitched) - sum(e["beats"] for e in aud_pitched)) < BEAT_EPS:
        return False  # timings already agree; nothing to repair

    # Rebuild note order: aud event structure, our pitch elements.
    attrs = [c for c in measure if c.tag != "note"]
    our_iter = iter(our_pitched)
    new_notes: list[ET.Element] = []
    for ae in aud_events:
        dur_units = str(int(round(ae["beats"] * divisions)))
        if ae["kind"] == "rest":
            rest = ET.Element("note")
            ET.SubElement(rest, "rest")
            ET.SubElement(rest, "duration").text = dur_units
            new_notes.append(rest)
            continue
        oe = next(our_iter)
        for our_note, aud_note in zip(oe["notes"], ae["notes"]):
            d = our_note.find("duration")
            if d is None:
                d = ET.SubElement(our_note, "duration")
            d.text = dur_units
            for tag in ("type", "dot"):
                el = our_note.find(tag)
                if el is not None:
                    our_note.remove(el)
                src = aud_note.find(tag)
                if src is not None:
                    copy = ET.Element(tag)
                    copy.text = src.text
                    our_note.append(copy)
            new_notes.append(our_note)
        # extra chord notes on our side keep their (now updated) duration
        for our_note in oe["notes"][len(ae["notes"]):]:
            d = our_note.find("duration")
            if d is not None:
                d.text = dur_units
            new_notes.append(our_note)

    for c in list(measure):
        measure.remove(c)
    for c in attrs:
        measure.append(c)
    for n in new_notes:
        measure.append(n)
    return True


def refine_measures_with_audiveris(
    measures: list[ET.Element], aud_root: ET.Element
) -> int:
    """Refine one staff-voice's page-local measure list in place.

    Picks the Audiveris part whose index-aligned measures best step-match
    ours, then applies the gated alter/rhythm merges. Returns the number of
    measures modified.
    """
    if aud_root is None or not measures:
        return 0

    our_divisions = 4
    div = next((m.findtext(".//divisions") for m in measures if m.find(".//divisions") is not None), None)
    if div and str(div).isdigit():
        our_divisions = int(div)
    our_parsed = []
    for m in measures:
        has_unpitched = any(n.find("unpitched") is not None for n in m.findall("note"))
        our_parsed.append((m, _measure_beats(m, our_divisions), has_unpitched))

    best: tuple[float, Optional[list[list[dict]]]] = (0.0, None)
    for part in aud_root.findall(".//part"):
        aud_div = _part_divisions(part)
        aud_measures = [_measure_beats(m, aud_div) for m in part.findall("measure")]
        pitched_idx = [
            i for i in range(min(len(our_parsed), len(aud_measures)))
            if not our_parsed[i][2]
            and any(e["kind"] == "note" for e in our_parsed[i][1])
        ]
        if not pitched_idx:
            continue
        matches = sum(
            1 for i in pitched_idx if _steps_match(our_parsed[i][1], aud_measures[i])
        )
        score = matches / len(pitched_idx)
        if matches and score > best[0]:
            best = (score, aud_measures)

    if best[1] is None or best[0] < MIN_PART_SCORE:
        return 0

    aud_measures = best[1]
    changed = 0
    for i in range(min(len(our_parsed), len(aud_measures))):
        measure, our_events, has_unpitched = our_parsed[i]
        if has_unpitched or not _steps_match(our_events, aud_measures[i]):
            continue
        modified = _adopt_alters(our_events, aud_measures[i]) > 0
        if _adopt_rhythm(measure, our_events, aud_measures[i], our_divisions):
            modified = True
        if modified:
            changed += 1
    return changed
