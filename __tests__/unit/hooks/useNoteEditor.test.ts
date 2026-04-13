import { renderHook, act } from "@testing-library/react-native";
import {
  useNoteEditor,
} from "../../../client/hooks/useNoteEditor";
import type { NoteEditorState, NoteEditorActions } from "../../../client/hooks/useNoteEditor";
import {
  SAMPLE_MUSICXML,
  parseMusicXml,
} from "../../../client/lib/audio/musicXmlParser";
import { parseMusicXml as reparse } from "../../../client/lib/audio/musicXmlParser";

jest.mock("../../../client/lib/audio/synthEngine", () => ({
  playNote: jest.fn(),
  resumeAudioContext: jest.fn().mockResolvedValue(undefined),
}));

const noteSequence = parseMusicXml(SAMPLE_MUSICXML);

type HookResult = NoteEditorState & NoteEditorActions;

describe("useNoteEditor — initial state", () => {
  it("editedMusicXml equals SAMPLE_MUSICXML", () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    expect(result.current.editedMusicXml).toBe(SAMPLE_MUSICXML);
  });

  it("selectedIndex is null", () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    expect(result.current.selectedIndex).toBeNull();
  });

  it("selectedPitch is null", () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    expect(result.current.selectedPitch).toBeNull();
  });

  it("hasEdits is false", () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    expect(result.current.hasEdits).toBe(false);
  });
});

describe("useNoteEditor — selectNote", () => {
  it("selectNote(0) sets selectedIndex to 0", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    expect(result.current.selectedIndex).toBe(0);
  });

  it("selectNote(0) sets selectedPitch to { step: 'C', alter: 0, octave: 4 }", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    expect(result.current.selectedPitch).toEqual({
      step: "C",
      alter: 0,
      octave: 4,
    });
  });

  it("selectNote(-1) leaves selectedPitch null", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(-1);
    });
    expect(result.current.selectedPitch).toBeNull();
  });

  it("selectNote(noteSequence.length + 99) leaves selectedPitch null", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(noteSequence.length + 99);
    });
    expect(result.current.selectedPitch).toBeNull();
  });
});

describe("useNoteEditor — applyPitch", () => {
  it("applyPitch after selectNote(0) sets selectedIndex back to null", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    expect(result.current.selectedIndex).toBeNull();
  });

  it("applyPitch after selectNote(0) sets hasEdits to true", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    expect(result.current.hasEdits).toBe(true);
  });

  it("applyPitch changes editedMusicXml (not equal to original)", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    expect(result.current.editedMusicXml).not.toBe(SAMPLE_MUSICXML);
  });

  it("re-parsing editedMusicXml after applyPitch('G',0,4) gives G4 at t≈0", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    const reparsed = reparse(result.current.editedMusicXml);
    const atZero = reparsed.find((n) => Math.abs(n.startTime) < 0.05);
    expect(atZero).toBeDefined();
    expect(atZero!.pitch).toBe("G4");
  });

  it("applyPitch without prior selectNote is a no-op (editedMusicXml unchanged)", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    expect(result.current.editedMusicXml).toBe(SAMPLE_MUSICXML);
    expect(result.current.hasEdits).toBe(false);
  });
});

describe("useNoteEditor — dismiss", () => {
  it("dismiss clears selectedIndex", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.dismiss();
    });
    expect(result.current.selectedIndex).toBeNull();
  });

  it("dismiss clears selectedPitch", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.dismiss();
    });
    expect(result.current.selectedPitch).toBeNull();
  });

  it("dismiss does not change editedMusicXml", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.dismiss();
    });
    expect(result.current.editedMusicXml).toBe(SAMPLE_MUSICXML);
  });

  it("dismiss does not set hasEdits", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.dismiss();
    });
    expect(result.current.hasEdits).toBe(false);
  });
});

describe("useNoteEditor — resetEdits", () => {
  it("resetEdits restores editedMusicXml to original", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    await act(async () => {
      result.current.resetEdits();
    });
    expect(result.current.editedMusicXml).toBe(SAMPLE_MUSICXML);
  });

  it("resetEdits sets hasEdits to false", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    await act(async () => {
      result.current.resetEdits();
    });
    expect(result.current.hasEdits).toBe(false);
  });

  it("resetEdits clears selectedIndex", async () => {
    const { result } = renderHook<HookResult, unknown>(() =>
      useNoteEditor(SAMPLE_MUSICXML, noteSequence),
    );
    await act(async () => {
      result.current.selectNote(0);
    });
    await act(async () => {
      result.current.applyPitch("G", 0, 4);
    });
    await act(async () => {
      result.current.resetEdits();
    });
    expect(result.current.selectedIndex).toBeNull();
  });
});
