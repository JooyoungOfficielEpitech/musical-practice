"""Test voice_splitter on the separated outputs."""
import sys
sys.path.insert(0, '/Users/mmecoco/Desktop/musical-practice/tools/omr-server')

from pipeline.voice_splitter import split_voices
import xml.etree.ElementTree as ET

for variant in ["up", "down"]:
    xml_file = f"debug_voicesep/hyp2_spike_p8_Co-SA_0_{variant}_base.musicxml"
    
    with open(xml_file) as f:
        content = f.read()
    
    root = ET.fromstring(content)
    
    try:
        result = split_voices(root)
        print(f"\n{variant.upper()} after split_voices:")
        for voice_id, notes in result.items():
            print(f"  Voice {voice_id}: {len(notes)} notes")
            if notes:
                midi_vals = [n.get("midi", 0) for n in notes if "midi" in n.attrib]
                if midi_vals:
                    midi_vals = [int(m) for m in midi_vals]
                    print(f"    Mean MIDI: {sum(midi_vals) / len(midi_vals):.1f}")
    except Exception as e:
        print(f"\n{variant.upper()} split_voices error: {e}")
