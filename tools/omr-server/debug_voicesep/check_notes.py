"""Extract and compare notes from the hyp2 XML files."""
import re

for variant in ["up", "down"]:
    xml_file = f"debug_voicesep/hyp2_spike_p8_Co-SA_0_{variant}_base.musicxml"
    with open(xml_file) as f:
        content = f.read()
    
    notes = []
    for match in re.finditer(
        r"<pitch>.*?<step>([A-G])</step>.*?<octave>(\d+)</octave>",
        content,
        re.DOTALL,
    ):
        step = match.group(1)
        octave = int(match.group(2))
        midi = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[step] + (octave + 1) * 12
        notes.append((step, octave, midi))
    
    print(f"\n{variant.upper()} voice notes:")
    for step, octave, midi in notes:
        print(f"  {step}{octave} (MIDI {midi})")
    
    if notes:
        midi_vals = [n[2] for n in notes]
        print(f"  Mean MIDI: {sum(midi_vals) / len(midi_vals):.1f}")
        print(f"  Range: {min(midi_vals)} to {max(midi_vals)}")
