"""OMR accuracy grader: compare produced MusicXML to ground truth JSON."""
from __future__ import annotations
import json
import xml.etree.ElementTree as ET
from typing import Optional

SEMITONE_CLASS = {
    "C": "C", "C#": "C#", "Db": "C#",
    "D": "D", "D#": "D#", "Eb": "D#",
    "E": "E", "E#": "E", "Fb": "E",
    "F": "F", "F#": "F#", "Gb": "F#",
    "G": "G", "G#": "G#", "Ab": "G#",
    "A": "A", "A#": "A#", "Bb": "A#",
    "B": "B", "B#": "C", "Cb": "B",
}
RHYTHM_TOLERANCE = 1 / 24.0


def normalize_pitch(step: str, alter: int, octave: int) -> str:
    """Convert (step, alter, octave) to pitch string."""
    pitch = step + ("#" * alter if alter > 0 else "b" * (-alter))
    return f"{pitch}{octave}"


def _get_semitone_class(pitch_str: str) -> Optional[str]:
    """Get semitone class of pitch (handles enharmonic equivalence)."""
    if not pitch_str or pitch_str == "rest" or pitch_str.startswith("X"):
        return pitch_str
    pitch_part = pitch_str[:-1] if pitch_str[-1].isdigit() else pitch_str
    return SEMITONE_CLASS.get(pitch_part, pitch_part)


def pitches_match(p1: Optional[str], p2: Optional[str]) -> bool:
    """Check if pitches match (including enharmonic equivalence)."""
    if p1 is None or p2 is None:
        return False
    if p1 == "rest" and p2 == "rest":
        return True
    if p1.startswith("X") or p2.startswith("X"):
        return True
    if p1 == "rest" or p2 == "rest":
        return p1.startswith("X") or p2.startswith("X")
    return _get_semitone_class(p1) == _get_semitone_class(p2)


def durations_match(d1: Optional[float], d2: Optional[float]) -> bool:
    """Check if durations match within tolerance."""
    if d1 is None or d2 is None:
        return False
    return abs(d1 - d2) <= RHYTHM_TOLERANCE


def extract_notes_from_xml(xml_path: str, part_id: str) -> list[tuple]:
    """Extract (measure_num, onset_beat, pitch, duration_beat) from MusicXML.

    part_id accepts a part @id (P3) or a part-name/abbreviation ("Herm.").
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()
    part = root.find(f".//part[@id='{part_id}']")
    if part is None:
        for sp in root.findall(".//score-part"):
            names = [sp.findtext("part-name") or "", sp.findtext("part-abbreviation") or ""]
            if any(part_id.lower() in n.lower() or n.lower() in part_id.lower() for n in names if n):
                part = root.find(f".//part[@id=\'{sp.get("id")}\']")
                break
    if part is None:
        raise ValueError(f"Part {part_id} not found")

    notes, divisions = [], 4
    for measure in part.findall("measure"):
        div_elem = measure.find(".//divisions")
        if div_elem is not None and div_elem.text:
            divisions = int(div_elem.text)

        onset = 0.0
        for note_elem in measure.findall("note"):
            is_chord = note_elem.find("chord") is not None
            dur_elem = note_elem.find("duration")
            if dur_elem is None or not dur_elem.text:
                continue

            duration = int(dur_elem.text) / divisions
            if note_elem.find("rest") is not None:
                pitch = "rest"
            else:
                pitch_elem = note_elem.find("pitch")
                if pitch_elem is None:
                    continue
                step = pitch_elem.findtext("step", "C")
                alter = int(pitch_elem.findtext("alter", "0") or 0)
                octave = int(pitch_elem.findtext("octave", "4"))
                notehead = note_elem.findtext("notehead", "").lower()
                pitch = f"X{octave}" if notehead == "x" else normalize_pitch(step, alter, octave)

            notes.append((int(measure.get("number", 1)), onset, pitch, duration))
            if not is_chord:
                onset += duration

    return notes


def _align_notes(produced: list[tuple], gt: list[tuple]) -> tuple[list[tuple], list[tuple]]:
    """Greedily align produced notes to ground truth by onset."""
    pitch_pairs, rhythm_pairs = [], []
    produced_sorted, gt_sorted = sorted(produced, key=lambda x: x[0]), sorted(gt, key=lambda x: x[0])
    used_gt = set()

    for p_onset, p_pitch, p_dur in produced_sorted:
        best_idx = None
        for gt_idx, (gt_onset, gt_pitch, gt_dur) in enumerate(gt_sorted):
            if gt_idx not in used_gt and (best_idx is None or abs(p_onset - gt_onset) < abs(p_onset - gt_sorted[best_idx][0])):
                best_idx = gt_idx
        if best_idx is not None and abs(p_onset - gt_sorted[best_idx][0]) <= RHYTHM_TOLERANCE:
            used_gt.add(best_idx)
            gt_onset, gt_pitch, gt_dur = gt_sorted[best_idx]
            pitch_pairs.append((p_pitch, gt_pitch))
            rhythm_pairs.append(((p_onset, p_dur), (gt_onset, gt_dur)))
        else:
            pitch_pairs.append((p_pitch, None))
            rhythm_pairs.append(((p_onset, p_dur), None))

    for gt_idx, (gt_onset, gt_pitch, gt_dur) in enumerate(gt_sorted):
        if gt_idx not in used_gt:
            pitch_pairs.append((None, gt_pitch))
            rhythm_pairs.append((None, (gt_onset, gt_dur)))

    return pitch_pairs, rhythm_pairs


def _compute_f1(p: float, r: float) -> float:
    """Compute F1 score."""
    return 0.0 if p + r == 0 else 2 * p * r / (p + r)


def grade(musicxml_path: str, gt_json_path: str, part_id: str) -> dict:
    """Grade OMR accuracy: pitch F1, rhythm F1, measure accuracy, per-measure breakdown."""
    produced_notes = extract_notes_from_xml(musicxml_path, part_id)
    with open(gt_json_path) as f:
        gt_data = json.load(f)
    gt_measures = {m["n"]: m["notes"] for m in gt_data["measures"]}
    produced_by_measure = {}
    for measure_num, onset, pitch, duration in produced_notes:
        if measure_num not in produced_by_measure:
            produced_by_measure[measure_num] = []
        produced_by_measure[measure_num].append((onset, pitch, duration))

    per_measure = []
    tp, fp, fn_p, tp_r, fp_r, fn_r = 0, 0, 0, 0, 0, 0
    perfect_count = 0

    for measure_num in sorted(set(produced_by_measure.keys()) | set(gt_measures.keys())):
        produced = produced_by_measure.get(measure_num, [])
        gt_parsed = []
        gt_onset = 0.0
        for pitch, beats in gt_measures.get(measure_num, []):
            gt_parsed.append((gt_onset, pitch, beats))
            gt_onset += beats

        pitch_pairs, rhythm_pairs = _align_notes(produced, gt_parsed)
        p_correct = sum(1 for p1, p2 in pitch_pairs if p1 is not None and p2 is not None and pitches_match(p1, p2))
        r_correct = 0
        for rp in rhythm_pairs:
            if rp[0] is not None and rp[1] is not None:
                r_correct += int(durations_match(rp[0][1], rp[1][1]))

        p_prec = p_correct / len(produced) if produced else 1.0
        p_rec = p_correct / len(gt_parsed) if gt_parsed else 1.0
        r_prec = r_correct / len(produced) if produced else 1.0
        r_rec = r_correct / len(gt_parsed) if gt_parsed else 1.0

        per_measure.append({
            "measure": measure_num,
            "pitch_precision": round(p_prec, 4),
            "pitch_recall": round(p_rec, 4),
            "pitch_f1": round(_compute_f1(p_prec, p_rec), 4),
            "rhythm_precision": round(r_prec, 4),
            "rhythm_recall": round(r_rec, 4),
            "rhythm_f1": round(_compute_f1(r_prec, r_rec), 4),
            "pitch_correct": p_correct,
            "rhythm_correct": r_correct,
            "produced_count": len(produced),
            "ground_truth_count": len(gt_parsed),
        })

        tp += p_correct
        fp += len(produced) - p_correct
        fn_p += len(gt_parsed) - p_correct
        tp_r += r_correct
        fp_r += len(produced) - r_correct
        fn_r += len(gt_parsed) - r_correct
        if p_prec == 1.0 and p_rec == 1.0 and r_prec == 1.0 and r_rec == 1.0:
            perfect_count += 1

    all_measures = sorted(set(produced_by_measure.keys()) | set(gt_measures.keys()))
    p_prec = tp / (tp + fp) if tp + fp > 0 else 1.0
    p_rec = tp / (tp + fn_p) if tp + fn_p > 0 else 1.0
    r_prec = tp_r / (tp_r + fp_r) if tp_r + fp_r > 0 else 1.0
    r_rec = tp_r / (tp_r + fn_r) if tp_r + fn_r > 0 else 1.0

    return {
        "pitch_f1": round(_compute_f1(p_prec, p_rec), 4),
        "rhythm_f1": round(_compute_f1(r_prec, r_rec), 4),
        "measure_accuracy": round(perfect_count / len(all_measures) if all_measures else 1.0, 4),
        "per_measure": per_measure,
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print("Usage: python -m pipeline.grader <xml> <gt.json> <part>")
        sys.exit(1)
    print(json.dumps(grade(sys.argv[1], sys.argv[2], sys.argv[3]), indent=2))
