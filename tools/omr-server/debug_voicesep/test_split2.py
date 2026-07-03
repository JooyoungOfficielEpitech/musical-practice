"""Test voice_splitter on the separated outputs."""
import sys
sys.path.insert(0, '/Users/mmecoco/Desktop/musical-practice/tools/omr-server')

from pipeline.voice_splitter import split_voices
import re

for variant in ["up", "down"]:
    xml_file = f"debug_voicesep/hyp2_spike_p8_Co-SA_0_{variant}_base.musicxml"
    
    with open(xml_file) as f:
        xml_string = f.read()
    
    try:
        result = split_voices(xml_string)
        print(f"\n{variant.upper()} after split_voices:")
        for voice_id, voice_xml in result.items():
            notes = []
            for match in re.finditer(
                r"<pitch>.*?<step>([A-G])</step>.*?<octave>(\d+)</octave>",
                voice_xml,
                re.DOTALL,
            ):
                step = match.group(1)
                octave = int(match.group(2))
                midi = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[step] + (octave + 1) * 12
                notes.append((step, octave, midi))
            
            print(f"  {voice_id}: {len(notes)} notes")
            if notes:
                midi_vals = [n[2] for n in notes]
                print(f"    Mean MIDI: {sum(midi_vals) / len(midi_vals):.1f}")
                print(f"    Notes: {', '.join(f'{n[0]}{n[1]}' for n in notes)}")
    except Exception as e:
        print(f"\n{variant.upper()} split_voices error: {e}")
        import traceback
        traceback.print_exc()
