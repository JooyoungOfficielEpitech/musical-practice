import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import { PitchPicker } from "../../client/components/PitchPicker";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      background: "#fff",
      backgroundSecondary: "#f9f9f9",
      surface: "#fff",
      text: "#000",
      textSecondary: "#666",
      primary: "#2563EB",
      border: "#e5e7eb",
      error: "#dc2626",
    },
    isDark: false,
  }),
}));

const noop = () => {};

describe("PitchPicker — visibility", () => {
  it("does not show note buttons when visible=false", () => {
    render(
      <PitchPicker
        visible={false}
        initialPitch={{ step: "C", alter: 0, octave: 4 }}
        onConfirm={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.queryByText("C#")).toBeNull();
  });

  it("shows all 12 chromatic note labels when visible=true", () => {
    render(
      <PitchPicker
        visible={true}
        initialPitch={{ step: "C", alter: 0, octave: 4 }}
        onConfirm={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("C#")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();
    expect(screen.getByText("D#")).toBeTruthy();
    expect(screen.getByText("E")).toBeTruthy();
    expect(screen.getByText("F")).toBeTruthy();
    expect(screen.getByText("F#")).toBeTruthy();
    expect(screen.getByText("G")).toBeTruthy();
    expect(screen.getByText("G#")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("A#")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });
});

describe("PitchPicker — octave selector", () => {
  it("shows octave buttons 2 through 6 when visible=true", () => {
    render(
      <PitchPicker
        visible={true}
        initialPitch={{ step: "C", alter: 0, octave: 4 }}
        onConfirm={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
  });
});

describe("PitchPicker — confirm", () => {
  it('tapping "G#" then Confirm calls onConfirm("G", 1, 4)', () => {
    const onConfirm = jest.fn();
    render(
      <PitchPicker
        visible={true}
        initialPitch={{ step: "C", alter: 0, octave: 4 }}
        onConfirm={onConfirm}
        onDismiss={noop}
      />,
    );
    fireEvent.press(screen.getByText("G#"));
    fireEvent.press(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith("G", 1, 4);
  });

  it('tapping octave "5", then "C", then Confirm calls onConfirm("C", 0, 5)', () => {
    const onConfirm = jest.fn();
    render(
      <PitchPicker
        visible={true}
        initialPitch={{ step: "C", alter: 0, octave: 4 }}
        onConfirm={onConfirm}
        onDismiss={noop}
      />,
    );
    fireEvent.press(screen.getByText("5"));
    fireEvent.press(screen.getByText("C"));
    fireEvent.press(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith("C", 0, 5);
  });
});

describe("PitchPicker — cancel", () => {
  it('tapping "Cancel" calls onDismiss and does not call onConfirm', () => {
    const onConfirm = jest.fn();
    const onDismiss = jest.fn();
    render(
      <PitchPicker
        visible={true}
        initialPitch={{ step: "C", alter: 0, octave: 4 }}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(screen.getByText("Cancel"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
