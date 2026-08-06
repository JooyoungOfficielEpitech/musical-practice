import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { NoteEditSheet } from "../../client/components/NoteEditSheet";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#000", textSecondary: "#666", primary: "#2563EB",
      backgroundSecondary: "#F3F4F6", surface: "#fff", buttonText: "#fff",
      borderLight: "#eee", overlay: "rgba(0,0,0,0.4)", error: "#DC2626",
    },
  }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    visible: true,
    selectedPitch: { step: "C", alter: 0, octave: 4 },
    canEdit: true,
    onApply: jest.fn(),
    onDismiss: jest.fn(),
    ...overrides,
  };
}

describe("NoteEditSheet", () => {
  it("renders nothing when not visible or without a selection", () => {
    expect(render(<NoteEditSheet {...(makeProps({ visible: false }) as any)} />).toJSON()).toBeNull();
    expect(render(<NoteEditSheet {...(makeProps({ selectedPitch: null }) as any)} />).toJSON()).toBeNull();
  });

  it("shows the scanned pitch", () => {
    const { getByText } = render(<NoteEditSheet {...(makeProps() as any)} />);
    expect(getByText("Scanned as C4")).toBeTruthy();
    expect(getByText("C4")).toBeTruthy();
  });

  it("a semitone up from C4 is C#4 (midi-correct stepping)", () => {
    const props = makeProps();
    const { getByLabelText, getByText } = render(<NoteEditSheet {...(props as any)} />);
    fireEvent.press(getByLabelText("Up semitone"));
    expect(getByText("C#4")).toBeTruthy();
    expect(getByText("C4 → C#4")).toBeTruthy();

    fireEvent.press(getByLabelText("Apply note C#4"));
    expect(props.onApply).toHaveBeenCalledWith("C", 1, 4);
  });

  it("a semitone down from C4 is B3 (crosses the octave)", () => {
    const props = makeProps();
    const { getByLabelText } = render(<NoteEditSheet {...(props as any)} />);
    fireEvent.press(getByLabelText("Down semitone"));
    fireEvent.press(getByLabelText("Apply note B3"));
    expect(props.onApply).toHaveBeenCalledWith("B", 0, 3);
  });

  it("octave steppers shift by 12 semitones", () => {
    const props = makeProps();
    const { getByLabelText } = render(<NoteEditSheet {...(props as any)} />);
    fireEvent.press(getByLabelText("Increase octave"));
    fireEvent.press(getByLabelText("Apply note C5"));
    expect(props.onApply).toHaveBeenCalledWith("C", 0, 5);
  });

  it("does not apply without a change", () => {
    const props = makeProps();
    const { getByLabelText } = render(<NoteEditSheet {...(props as any)} />);
    fireEvent.press(getByLabelText("Apply note C4"));
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it("blocks editing when the note can't be located safely", () => {
    const props = makeProps({ canEdit: false });
    const { getByLabelText, getByText } = render(<NoteEditSheet {...(props as any)} />);
    expect(getByText(/can't be matched/)).toBeTruthy();
    fireEvent.press(getByLabelText("Up semitone"));
    fireEvent.press(getByLabelText("Apply note C4"));
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it("dismisses via Cancel and close", () => {
    const props = makeProps();
    const { getByLabelText } = render(<NoteEditSheet {...(props as any)} />);
    fireEvent.press(getByLabelText("Cancel"));
    fireEvent.press(getByLabelText("Close note editor"));
    expect(props.onDismiss).toHaveBeenCalledTimes(2);
  });
});
