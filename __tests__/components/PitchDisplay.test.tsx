import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PitchDisplay } from "../../client/components/PitchDisplay";
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
    },
  }),
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

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

describe("PitchDisplay", () => {
  const onToggle = jest.fn();

  beforeEach(() => {
    onToggle.mockClear();
  });

  it("shows 'Tap to detect pitch' when not listening", () => {
    const { getByText } = render(
      <PitchDisplay
        isListening={false}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
      />,
    );

    expect(getByText("Tap to detect pitch")).toBeTruthy();
  });

  it("calls onToggle when start button is pressed", () => {
    const { getByText } = render(
      <PitchDisplay
        isListening={false}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
      />,
    );

    fireEvent.press(getByText("Tap to detect pitch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows 'Listening...' when listening but no pitch", () => {
    const { getByText } = render(
      <PitchDisplay
        isListening={true}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
      />,
    );

    expect(getByText("Listening...")).toBeTruthy();
  });

  it("shows note name and frequency when pitch detected", () => {
    const pitch = makePitch({ frequency: 440, note: "A", octave: 4 });

    const { getByText } = render(
      <PitchDisplay
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );

    // Note + octave are nested Text elements, rendered as "A4" combined
    expect(getByText(/A/)).toBeTruthy();
    expect(getByText(/440\.0/)).toBeTruthy();
  });

  it("shows 'In Tune' badge when cents <= 10", () => {
    const pitch = makePitch({ cents: 5 });

    const { getByText } = render(
      <PitchDisplay
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
      <PitchDisplay
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );

    expect(getByText("Sharp")).toBeTruthy();
  });

  it("shows 'Flat' badge when cents > 10 and negative", () => {
    const pitch = makePitch({ cents: -30 });

    const { getByText } = render(
      <PitchDisplay
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
      <PitchDisplay
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
      <PitchDisplay
        isListening={true}
        currentPitch={pitch}
        accuracy={0}
        onToggle={onToggle}
      />,
    );

    expect(queryByText(/Accuracy/)).toBeNull();
  });

  it("shows error message when error is provided", () => {
    const { getByText } = render(
      <PitchDisplay
        isListening={false}
        currentPitch={null}
        accuracy={0}
        onToggle={onToggle}
        error="Microphone unavailable"
      />,
    );

    expect(getByText("Microphone unavailable")).toBeTruthy();
  });

  it("error state takes priority over other states", () => {
    const pitch = makePitch();

    const { getByText, queryByText } = render(
      <PitchDisplay
        isListening={true}
        currentPitch={pitch}
        accuracy={50}
        onToggle={onToggle}
        error="Some error"
      />,
    );

    expect(getByText("Some error")).toBeTruthy();
    expect(queryByText("A")).toBeNull();
    expect(queryByText("Listening...")).toBeNull();
  });
});
