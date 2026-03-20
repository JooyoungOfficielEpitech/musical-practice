import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MusicalStaff } from "../../client/components/MusicalStaff";
import type { PitchResult } from "../../client/lib/audio/types";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#FF69B4",
      text: "#333333",
      textSecondary: "#888888",
      success: "#6BA368",
      warning: "#FFA94D",
      error: "#FF6B6B",
      borderLight: "#FFE8F0",
      surface: "#FFF5F8",
    },
  }),
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock react-native-svg
jest.mock("react-native-svg", () => {
  const { View, Text } = require("react-native");
  return {
    __esModule: true,
    default: View, // Svg
    Svg: View,
    Line: View,
    Ellipse: (props: any) => <View testID={props.testID} />,
    Text: Text,
    G: View,
  };
});

function makePitch(overrides: Partial<PitchResult> = {}): PitchResult {
  return {
    frequency: 440,
    note: "A",
    octave: 4,
    cents: 0,
    clarity: 0.95,
    ...overrides,
  };
}

describe("MusicalStaff", () => {
  const onToggle = jest.fn();

  beforeEach(() => onToggle.mockClear());

  it("shows mic button when not listening", () => {
    const { getByText } = render(
      <MusicalStaff
        isListening={false}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByText("Tap to detect pitch")).toBeTruthy();
  });

  it("calls onToggle when mic button pressed", () => {
    const { getByText } = render(
      <MusicalStaff
        isListening={false}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    fireEvent.press(getByText("Tap to detect pitch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows Listening when active but no pitch", () => {
    const { getByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByText("Listening...")).toBeTruthy();
  });

  it("shows stop button when listening without pitch", () => {
    const { getByLabelText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    const stopBtn = getByLabelText("Stop pitch detection");
    fireEvent.press(stopBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows note name when pitch detected", () => {
    const pitch = makePitch({ note: "A", octave: 4 });
    const { getByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByText("A4")).toBeTruthy();
  });

  it("shows note head when pitch detected", () => {
    const pitch = makePitch({ note: "A", octave: 4 });
    const { getByTestId } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByTestId("note-head")).toBeTruthy();
  });

  it("shows error message when error is provided", () => {
    const { getByText } = render(
      <MusicalStaff
        isListening={false}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
        error="Mic failed"
      />,
    );
    expect(getByText("Mic failed")).toBeTruthy();
  });

  it("shows frequency text when pitch detected", () => {
    const pitch = makePitch({ frequency: 440 });
    const { getByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByText("440.0 Hz")).toBeTruthy();
  });

  it("shows 'In Tune' badge when cents <= 10", () => {
    const pitch = makePitch({ cents: 5 });
    const { getByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByText("In Tune")).toBeTruthy();
  });

  it("shows 'Sharp' badge when cents > 10 and positive", () => {
    const pitch = makePitch({ cents: 30 });
    const { getByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByText("Sharp")).toBeTruthy();
  });

  it("shows 'Flat' badge when cents < -10", () => {
    const pitch = makePitch({ cents: -30 });
    const { getByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(getByText("Flat")).toBeTruthy();
  });

  it("shows accuracy badge when accuracy > 0", () => {
    const pitch = makePitch();
    const { getByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={85}
        onToggle={onToggle}
      />,
    );
    expect(getByText("Accuracy: 85%")).toBeTruthy();
  });

  it("hides accuracy badge when accuracy is 0", () => {
    const pitch = makePitch();
    const { queryByText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    expect(queryByText(/Accuracy/)).toBeNull();
  });

  it("shows stop button when pitch is detected", () => {
    const pitch = makePitch();
    const { getByLabelText } = render(
      <MusicalStaff
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );
    const stopBtn = getByLabelText("Stop pitch detection");
    fireEvent.press(stopBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  describe("out-of-range note clamping", () => {
    it("does not show 8va/8vb indicators", () => {
      const pitch = makePitch({ note: "E", octave: 6, frequency: 1318.5 });
      const { queryByText, getByText } = render(
        <MusicalStaff
          isListening={true}
          currentPitch={pitch}
          accuracy={0}
          onToggle={onToggle}
        />,
      );
      expect(queryByText("8va")).toBeNull();
      expect(queryByText("8vb")).toBeNull();
      // Real note name with octave still shown
      expect(getByText("E6")).toBeTruthy();
    });

    it("still shows real note name for low notes", () => {
      const pitch = makePitch({ note: "E", octave: 3, frequency: 164.8 });
      const { queryByText, getByText } = render(
        <MusicalStaff
          isListening={true}
          currentPitch={pitch}
          accuracy={0}
          onToggle={onToggle}
        />,
      );
      expect(queryByText("8va")).toBeNull();
      expect(queryByText("8vb")).toBeNull();
      expect(getByText("E3")).toBeTruthy();
    });
  });

  describe("solfège (도레미) display", () => {
    it("shows 라 for note A", () => {
      const pitch = makePitch({ note: "A", octave: 4 });
      const { getByText } = render(
        <MusicalStaff isListening={true} currentPitch={pitch} accuracy={0} onToggle={onToggle} />,
      );
      expect(getByText("라")).toBeTruthy();
    });

    it("shows 도 for note C", () => {
      const pitch = makePitch({ note: "C", octave: 5, frequency: 523.25 });
      const { getByText } = render(
        <MusicalStaff isListening={true} currentPitch={pitch} accuracy={0} onToggle={onToggle} />,
      );
      expect(getByText("도")).toBeTruthy();
    });

    it("shows 도 for C# (sharp ignored for solfège)", () => {
      const pitch = makePitch({ note: "C#", octave: 4, frequency: 277.18 });
      const { getByText } = render(
        <MusicalStaff isListening={true} currentPitch={pitch} accuracy={0} onToggle={onToggle} />,
      );
      expect(getByText("도")).toBeTruthy();
    });

    it("shows all solfège names correctly", () => {
      const notes = [
        { note: "C", expected: "도" },
        { note: "D", expected: "레" },
        { note: "E", expected: "미" },
        { note: "F", expected: "파" },
        { note: "G", expected: "솔" },
        { note: "A", expected: "라" },
        { note: "B", expected: "시" },
      ];
      for (const { note, expected } of notes) {
        const pitch = makePitch({ note, octave: 4 });
        const { getByText, unmount } = render(
          <MusicalStaff isListening={true} currentPitch={pitch} accuracy={0} onToggle={onToggle} />,
        );
        expect(getByText(expected)).toBeTruthy();
        unmount();
      }
    });
  });

  describe("passive mode (no onToggle)", () => {
    it("does not show mic button when onToggle is undefined", () => {
      const { queryByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      expect(queryByText("Tap to detect pitch")).toBeNull();
    });

    it("does not show stop button when listening without pitch", () => {
      const { queryByLabelText } = render(
        <MusicalStaff isListening={true} currentPitch={null} accuracy={0} />,
      );
      expect(queryByLabelText("Stop pitch detection")).toBeNull();
    });

    it("does not show stop button when pitch detected", () => {
      const pitch = makePitch();
      const { queryByLabelText } = render(
        <MusicalStaff isListening={true} currentPitch={pitch} accuracy={0} />,
      );
      expect(queryByLabelText("Stop pitch detection")).toBeNull();
    });

    it("still shows pitch info in passive mode", () => {
      const pitch = makePitch({ note: "A", octave: 4 });
      const { getByText } = render(
        <MusicalStaff isListening={true} currentPitch={pitch} accuracy={85} />,
      );
      expect(getByText("A4")).toBeTruthy();
      expect(getByText("Accuracy: 85%")).toBeTruthy();
    });
  });

  describe("octave range switcher", () => {
    it("shows default octave range 3~5", () => {
      const { getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      expect(getByText("3")).toBeTruthy();
      expect(getByText("5")).toBeTruthy();
    });

    it("increases high octave", () => {
      const { getByLabelText, getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      fireEvent.press(getByLabelText("Increase high octave"));
      expect(getByText("6")).toBeTruthy();
    });

    it("decreases low octave", () => {
      const { getByLabelText, getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      fireEvent.press(getByLabelText("Decrease low octave"));
      expect(getByText("2")).toBeTruthy();
    });

    it("increases low octave (narrows range)", () => {
      const { getByLabelText, getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      fireEvent.press(getByLabelText("Increase low octave"));
      expect(getByText("4")).toBeTruthy();
    });

    it("decreases high octave (narrows range)", () => {
      const { getByLabelText, getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      fireEvent.press(getByLabelText("Decrease high octave"));
      expect(getByText("4")).toBeTruthy();
    });

    it("prevents low octave going below 1", () => {
      const { getByLabelText, getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      // Default low = 3, press left twice to go to 1
      fireEvent.press(getByLabelText("Decrease low octave"));
      fireEvent.press(getByLabelText("Decrease low octave"));
      // Should stop at 1
      fireEvent.press(getByLabelText("Decrease low octave"));
      expect(getByText("1")).toBeTruthy();
    });

    it("prevents high octave going above 8", () => {
      const { getByLabelText, getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      // Default high = 5, press right 3 times to reach 8
      fireEvent.press(getByLabelText("Increase high octave"));
      fireEvent.press(getByLabelText("Increase high octave"));
      fireEvent.press(getByLabelText("Increase high octave"));
      // Should stop at 8
      fireEvent.press(getByLabelText("Increase high octave"));
      expect(getByText("8")).toBeTruthy();
    });

    it("prevents low >= high (must keep at least 1 octave gap)", () => {
      const { getByLabelText, getByText } = render(
        <MusicalStaff isListening={false} currentPitch={null} accuracy={0} />,
      );
      // Default: 3-5. Increase low to 4 (max allowed = high - 1 = 4)
      fireEvent.press(getByLabelText("Increase low octave"));
      fireEvent.press(getByLabelText("Increase low octave")); // should be blocked
      expect(getByText("4")).toBeTruthy(); // low stays 4
      expect(getByText("5")).toBeTruthy(); // high stays 5
    });
  });
});
