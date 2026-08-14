/**
 * Tests for client/hooks/useNoteEditor.ts
 * Selection by safe note identity (part + midi + occurrence), apply-by-locator,
 * and refusal to edit when the note can't be located unambiguously.
 */
import { renderHook, act } from "@testing-library/react-native";
import { useNoteEditor } from "../../../client/hooks/useNoteEditor";

jest.mock("../../../client/lib/audio/synthEngine", () => ({
  playNote: jest.fn(),
  resumeAudioContext: jest.fn().mockResolvedValue(undefined),
}));

const XML = `<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

const SECOND_C = { partIndex: 0, midiNumber: 60, occurrence: 1, pitch: "C4" };

describe("useNoteEditor", () => {
  it("selects a note, parses its pitch, and reports it as editable", () => {
    const { result } = renderHook(() => useNoteEditor(XML));
    act(() => result.current.selectNote(SECOND_C));

    expect(result.current.selectedNote).toEqual(SECOND_C);
    expect(result.current.selectedPitch).toEqual({ step: "C", alter: 0, octave: 4 });
    expect(result.current.canEditSelected).toBe(true);
  });

  it("flags an unlocatable note as not editable and refuses to apply", () => {
    const { result } = renderHook(() => useNoteEditor(XML));
    act(() => result.current.selectNote({ partIndex: 0, midiNumber: 60, occurrence: 9, pitch: "C4" }));
    expect(result.current.canEditSelected).toBe(false);

    let applied = true;
    act(() => { applied = result.current.applyPitch("D", 0, 4); });
    expect(applied).toBe(false);
    expect(result.current.hasEdits).toBe(false);
  });

  it("applies a pitch change to exactly the selected occurrence", () => {
    const onXmlChanged = jest.fn();
    const { result } = renderHook(() => useNoteEditor(XML, onXmlChanged));
    act(() => result.current.selectNote(SECOND_C));

    let applied = false;
    act(() => { applied = result.current.applyPitch("D", 1, 4); });

    expect(applied).toBe(true);
    expect(result.current.hasEdits).toBe(true);
    const xml = result.current.editedMusicXml;
    // First C untouched; second became D#4.
    const first = xml.indexOf("<step>C</step>");
    const edited = xml.indexOf("<step>D</step>");
    expect(first).toBeGreaterThan(-1);
    expect(edited).toBeGreaterThan(first);
    expect(xml).toContain("<pitch><step>D</step><alter>1</alter><octave>4</octave></pitch>");
    expect(onXmlChanged).toHaveBeenCalledWith(xml, true);
    // Selection clears after a successful apply.
    expect(result.current.selectedNote).toBeNull();
  });

  it("supports sequential edits (second edit sees the first)", () => {
    const { result } = renderHook(() => useNoteEditor(XML));
    act(() => result.current.selectNote(SECOND_C));
    act(() => { result.current.applyPitch("D", 0, 4); });
    // Now only ONE C4 remains — occurrence 0.
    act(() => result.current.selectNote({ partIndex: 0, midiNumber: 60, occurrence: 0, pitch: "C4" }));
    act(() => { result.current.applyPitch("B", 0, 3); });

    const xml = result.current.editedMusicXml;
    expect(xml).not.toContain("<step>C</step>");
    expect(xml).toContain("<step>B</step>");
    expect(xml).toContain("<step>D</step>");
  });

  it("resetEdits restores the original XML and notifies", () => {
    const onXmlChanged = jest.fn();
    const { result } = renderHook(() => useNoteEditor(XML, onXmlChanged));
    act(() => result.current.selectNote(SECOND_C));
    act(() => { result.current.applyPitch("D", 0, 4); });
    act(() => result.current.resetEdits());

    expect(result.current.editedMusicXml).toBe(XML);
    expect(result.current.hasEdits).toBe(false);
    expect(onXmlChanged).toHaveBeenLastCalledWith(XML, false);
  });

  it("keeps hasEdits and the undo baseline when the parent round-trips the edited XML", () => {
    const onXmlChanged = jest.fn();
    const { result, rerender } = renderHook<
      ReturnType<typeof useNoteEditor>,
      { xml: string }
    >(({ xml }) => useNoteEditor(xml, onXmlChanged), { initialProps: { xml: XML } });

    act(() => result.current.selectNote(SECOND_C));
    act(() => { result.current.applyPitch("D", 0, 4); });
    const edited = result.current.editedMusicXml;

    // Parent re-parses and feeds the edited XML back down.
    rerender({ xml: edited });
    expect(result.current.hasEdits).toBe(true); // NOT reset by our own edit

    act(() => result.current.resetEdits());
    expect(result.current.editedMusicXml).toBe(XML); // undo → the ORIGINAL
    expect(onXmlChanged).toHaveBeenLastCalledWith(XML, false);
  });

  it("dismiss clears the selection without editing", () => {
    const { result } = renderHook(() => useNoteEditor(XML));
    act(() => result.current.selectNote(SECOND_C));
    act(() => result.current.dismiss());
    expect(result.current.selectedNote).toBeNull();
    expect(result.current.hasEdits).toBe(false);
  });
});

describe("useNoteEditor — lyric editing", () => {
  const LYRIC_XML = `<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><lyric><syllabic>single</syllabic><text>절</text></lyric></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
  const FIRST_C = { partIndex: 0, midiNumber: 60, occurrence: 0, pitch: "C4" };
  const FIRST_D = { partIndex: 0, midiNumber: 62, occurrence: 0, pitch: "D4" };

  it("exposes the selected note's printed lyric", () => {
    const { result } = renderHook(() => useNoteEditor(LYRIC_XML));
    act(() => result.current.selectNote(FIRST_C));
    expect(result.current.selectedLyric).toBe("절");
    act(() => result.current.selectNote(FIRST_D));
    expect(result.current.selectedLyric).toBeNull();
  });

  it("fixes a misread lyric and notifies with hasEdits", () => {
    const onXmlChanged = jest.fn();
    const { result } = renderHook(() => useNoteEditor(LYRIC_XML, onXmlChanged));
    act(() => result.current.selectNote(FIRST_C));

    let ok = false;
    act(() => { ok = result.current.applyLyric("철"); });

    expect(ok).toBe(true);
    expect(result.current.editedMusicXml).toContain("<text>철</text>");
    expect(result.current.editedMusicXml).not.toContain("<text>절</text>");
    expect(onXmlChanged).toHaveBeenCalledWith(result.current.editedMusicXml, true);
  });

  it("adds a missing lyric to a bare note", () => {
    const { result } = renderHook(() => useNoteEditor(LYRIC_XML));
    act(() => result.current.selectNote(FIRST_D));
    act(() => { result.current.applyLyric("간"); });
    expect(result.current.editedMusicXml).toContain("<text>간</text>");
  });

  it("empty text removes the lyric", () => {
    const { result } = renderHook(() => useNoteEditor(LYRIC_XML));
    act(() => result.current.selectNote(FIRST_C));
    act(() => { result.current.applyLyric("") ; });
    expect(result.current.editedMusicXml).not.toContain("<lyric>");
  });
});
