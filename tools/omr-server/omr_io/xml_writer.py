"""MusicXML file I/O: load parts from files, combine parts, merge pages."""

import logging
import xml.etree.ElementTree as ET

log = logging.getLogger("omr.xml_writer")


def load_part(path: str) -> tuple[list[ET.Element], int]:
    """Load measures and divisions from a single-part MusicXML file.

    Returns:
        (measures, divisions) where measures is a list of <measure> elements
        and divisions is the quarter-note divisions value from the first measure.
    """
    tree = ET.parse(path)
    root = tree.getroot()
    part = root.find(".//part")
    if part is None:
        return [], 2

    measures = list(part.findall("measure"))
    divisions = 2
    for measure in measures:
        div_el = measure.find(".//divisions")
        if div_el is not None and div_el.text:
            divisions = int(div_el.text)
            break

    return measures, divisions


def combine_parts(
    parts: list[tuple[list[ET.Element], int]],
    output_path: str,
    title: str = "Untitled",
    composer: str = "Unknown",
) -> None:
    """Combine one or more (measures, divisions) tuples into a multi-part MusicXML file.

    Each tuple becomes one <part> in the output. Writes to output_path.
    """
    new_root = ET.Element("score-partwise")
    new_root.set("version", "3.1")

    work = ET.SubElement(new_root, "work")
    ET.SubElement(work, "work-title").text = title

    ident = ET.SubElement(new_root, "identification")
    creator = ET.SubElement(ident, "creator")
    creator.set("type", "composer")
    creator.text = composer

    pl = ET.SubElement(new_root, "part-list")

    for i, (measures, _) in enumerate(parts):
        part_id = f"P{i + 1}"
        sp = ET.SubElement(pl, "score-part")
        sp.set("id", part_id)
        ET.SubElement(sp, "part-name").text = f"Part {i + 1}"

        part_el = ET.SubElement(new_root, "part")
        part_el.set("id", part_id)

        for j, measure in enumerate(measures):
            measure.set("number", str(j + 1))
            part_el.append(measure)

    tree = ET.ElementTree(new_root)
    tree.write(output_path, encoding="unicode", xml_declaration=True)
    log.info(f"Wrote {len(parts)} parts to {output_path}")


def combine_chars_to_xml_string(
    char_measures: dict[str, list[ET.Element]],
    title: str = "Untitled",
    composer: str = "Unknown",
) -> str:
    """Build a multi-part MusicXML string from a {char_name: [measures]} dict.

    Character order is deterministic (sorted). Each character becomes one <part>.
    Returns the full MusicXML string with XML/DOCTYPE header, ready to upload.
    """
    ET.register_namespace("", "")

    char_names = sorted(char_measures.keys())
    new_root = ET.Element("score-partwise")
    new_root.set("version", "3.1")

    work = ET.SubElement(new_root, "work")
    ET.SubElement(work, "work-title").text = title

    ident = ET.SubElement(new_root, "identification")
    creator = ET.SubElement(ident, "creator")
    creator.set("type", "composer")
    creator.text = composer

    pl = ET.SubElement(new_root, "part-list")

    for i, char_name in enumerate(char_names):
        part_id = f"P{i + 1}"
        sp = ET.SubElement(pl, "score-part")
        sp.set("id", part_id)
        ET.SubElement(sp, "part-name").text = char_name

        part_el = ET.SubElement(new_root, "part")
        part_el.set("id", part_id)

        for j, measure in enumerate(char_measures[char_name]):
            measure.set("number", str(j + 1))
            if j == 0 and measure.find("attributes") is None:
                attrs = ET.Element("attributes")
                measure.insert(0, attrs)
                ET.SubElement(attrs, "divisions").text = "2"
                key = ET.SubElement(attrs, "key")
                ET.SubElement(key, "fifths").text = "0"
                time_el = ET.SubElement(attrs, "time")
                ET.SubElement(time_el, "beats").text = "4"
                ET.SubElement(time_el, "beat-type").text = "4"
                clef = ET.SubElement(attrs, "clef")
                ET.SubElement(clef, "sign").text = "G"
                ET.SubElement(clef, "line").text = "2"
            part_el.append(measure)

    log.info("combine_chars_to_xml_string: %d parts, %s", len(char_names), char_names)

    body = ET.tostring(new_root, encoding="unicode")
    header = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"'
        ' "http://www.musicxml.org/dtds/partwise.dtd">\n'
    )
    return header + body


def merge_pages(
    all_measures: list[list[ET.Element]],
    title: str = "Untitled",
    character: str = "Vocal",
    composer: str = "Unknown",
) -> str:
    """Merge measures from all pages into a single-part MusicXML string.

    Returns the MusicXML string (not written to disk — caller decides where to save).
    """
    new_root = ET.Element("score-partwise")
    new_root.set("version", "3.1")

    work = ET.SubElement(new_root, "work")
    ET.SubElement(work, "work-title").text = title

    ident = ET.SubElement(new_root, "identification")
    creator = ET.SubElement(ident, "creator")
    creator.set("type", "composer")
    creator.text = composer

    pl = ET.SubElement(new_root, "part-list")
    sp = ET.SubElement(pl, "score-part")
    sp.set("id", "P1")
    ET.SubElement(sp, "part-name").text = character

    part = ET.SubElement(new_root, "part")
    part.set("id", "P1")

    measure_num = 0
    for page_idx, page_measures in enumerate(all_measures):
        for m in page_measures:
            measure_num += 1
            m.set("number", str(measure_num))
            if measure_num == 1:
                if m.find("attributes") is None:
                    attrs = ET.Element("attributes")
                    m.insert(0, attrs)
                    ET.SubElement(attrs, "divisions").text = "2"
                    key = ET.SubElement(attrs, "key")
                    ET.SubElement(key, "fifths").text = "0"
                    time = ET.SubElement(attrs, "time")
                    ET.SubElement(time, "beats").text = "4"
                    ET.SubElement(time, "beat-type").text = "4"
                    clef = ET.SubElement(attrs, "clef")
                    ET.SubElement(clef, "sign").text = "G"
                    ET.SubElement(clef, "line").text = "2"
            else:
                for attrs in m.findall("attributes"):
                    m.remove(attrs)
                for d in m.findall("direction"):
                    m.remove(d)
            part.append(m)

    return ET.tostring(new_root, encoding="unicode", xml_declaration=True)
