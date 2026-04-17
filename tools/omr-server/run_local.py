"""Debug local runner: PDF → MusicXML with full intermediate image output.

Output structure:
  debug/<title>/
    page01_raw.png              # raw PDF render
    page01_char_<Name>_sys0_crop.png    # after crop_all_vocal_staves
    page01_char_<Name>_sys0_xfix.png    # after replace_x_noteheads
    page01_char_<Name>_sys0_homr_input.png  # exact image fed to homr
  output.xml                    # final combined MusicXML
  page01_char_<Name>_sys0.xml   # per-staff XML
"""
import sys
import logging
import os
import xml.etree.ElementTree as ET
import cv2

from omr_io.pdf_to_png import pdf_to_png
from core.staff_cropper import crop_all_vocal_staves, replace_x_noteheads
from pipeline.omr_runner import run_homr
from pipeline.postprocessor import postprocess as postprocess_musicxml
from omr_io.xml_writer import combine_chars_to_xml_string
from pipeline.alignment import align_and_flatten

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("run_local")


def _safe_name(s: str) -> str:
    return s.replace(" ", "_").replace(".", "").replace("/", "_")


def run(pdf_path: str, output_xml: str | None = None):
    title = os.path.splitext(os.path.basename(pdf_path))[0]
    debug_dir = os.path.join(os.path.dirname(os.path.abspath(pdf_path)), f"debug_{title}")
    os.makedirs(debug_dir, exist_ok=True)
    print(f"Debug images → {debug_dir}/")

    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        # ── Step 1: PDF → PNG ────────────────────────────────────────────────
        print(f"\n[1/4] Converting PDF → PNG at 300 DPI...")
        png_groups = pdf_to_png(pdf_path, [], tmp)
        all_pages = [p for group in png_groups for p in group]
        print(f"      {len(all_pages)} page(s)")

        all_char_sys: dict[str, dict[int, list[ET.Element]]] = {}
        all_known_chars: set[str] = set()
        all_sys_indices: list[int] = []
        sys_offset = 0

        for page_idx, img_path in enumerate(all_pages):
            page_tag = f"page{page_idx + 1:02d}"
            print(f"\n{'='*60}")
            print(f"[2/4] Page {page_idx + 1}: staff detection + crop")

            img = cv2.imread(img_path)

            # Save raw page
            raw_out = os.path.join(debug_dir, f"{page_tag}_raw.png")
            cv2.imwrite(raw_out, img)
            print(f"      Saved raw → {page_tag}_raw.png")

            # ── Step 2: crop all vocal staves ─────────────────────────────
            staves_dict, sys_info = crop_all_vocal_staves(img)
            if not staves_dict:
                print(f"      [WARN] No vocal staves detected — skipping page")
                continue

            print(f"      Detected characters: {list(staves_dict.keys())}")
            for char, stave_list in staves_dict.items():
                print(f"        {char}: {len(stave_list)} system(s)")

            local_sys = sorted({s for staves in staves_dict.values() for _, s in staves})
            local_to_global = {s: sys_offset + i for i, s in enumerate(local_sys)}
            global_indices = [local_to_global[s] for s in local_sys]
            if global_indices:
                sys_offset = max(global_indices) + 1
            all_sys_indices.extend(global_indices)

            # ── Step 3 + 4: per character, per system ─────────────────────
            print(f"\n[3/4] x-notehead replacement + homr per staff")
            for char, stave_list in staves_dict.items():
                safe_char = _safe_name(char)
                for staff_img, local_s in stave_list:
                    g_idx = local_to_global[local_s]
                    tag = f"{page_tag}_char_{safe_char}_sys{g_idx}"

                    # Save crop
                    crop_out = os.path.join(debug_dir, f"{tag}_1_crop.png")
                    cv2.imwrite(crop_out, staff_img)

                    # x-notehead replacement
                    xfixed = replace_x_noteheads(staff_img)
                    xfix_out = os.path.join(debug_dir, f"{tag}_2_xfix.png")
                    cv2.imwrite(xfix_out, xfixed)

                    # Save exact homr input
                    homr_in = os.path.join(tmp, f"{tag}_homr_input.png")
                    cv2.imwrite(homr_in, xfixed)
                    homr_debug = os.path.join(debug_dir, f"{tag}_3_homr_input.png")
                    cv2.imwrite(homr_debug, xfixed)

                    print(f"      [{char} sys{g_idx}] running homr...")
                    raw_xml = run_homr(homr_in, tmp)

                    if raw_xml is None:
                        print(f"      [{char} sys{g_idx}] homr returned nothing")
                        all_char_sys.setdefault(char, {})[g_idx] = []
                        all_known_chars.add(char)
                        continue

                    xml = postprocess_musicxml(raw_xml)

                    # Save per-staff XML
                    staff_xml_path = os.path.join(debug_dir, f"{tag}.xml")
                    with open(staff_xml_path, "w") as f:
                        f.write(xml)

                    try:
                        root = ET.fromstring(xml)
                        part = root.find(".//part")
                        measures = list(part.findall("measure")) if part is not None else []
                    except ET.ParseError:
                        measures = []

                    print(f"      [{char} sys{g_idx}] {len(measures)} measure(s) → {tag}.xml")
                    all_char_sys.setdefault(char, {})[g_idx] = measures
                    all_known_chars.add(char)

        # ── Step 5: align + combine ──────────────────────────────────────
        print(f"\n[4/4] Aligning and combining all parts...")
        if not all_known_chars:
            print("[ERROR] No characters detected across all pages")
            return

        char_flat = align_and_flatten(all_char_sys, all_known_chars, all_sys_indices)
        char_flat = {c: m for c, m in char_flat.items() if m}
        if not char_flat:
            print("[ERROR] All characters empty after alignment")
            return

        print(f"      Characters in output: {list(char_flat.keys())}")
        combined_xml = combine_chars_to_xml_string(char_flat, title=title)

    out_path = output_xml or "output.xml"
    with open(out_path, "w") as f:
        f.write(combined_xml)
    print(f"\nSaved → {out_path}")
    print(f"Debug images → {debug_dir}/")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_local.py <path/to/file.pdf> [output.xml]")
        sys.exit(1)
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
