import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Metronome } from "../../client/components/Metronome";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333333",
      textSecondary: "#888888",
      primary: "#2563EB",
      primaryDark: "#1D4ED8",
      success: "#16A34A",
      error: "#DC2626",
      backgroundSecondary: "#F8F9FA",
      buttonText: "#FFFFFF",
      ripple: "rgba(0,0,0,0.1)",
      rippleLight: "rgba(255,255,255,0.3)",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
}));

describe("Metronome", () => {
  it("renders with default BPM", () => {
    const { getByText } = render(<Metronome />);
    expect(getByText("120")).toBeTruthy();
    expect(getByText("BPM")).toBeTruthy();
  });

  it("renders with custom initialBpm", () => {
    const { getByText } = render(<Metronome initialBpm={100} />);
    expect(getByText("100")).toBeTruthy();
  });

  it("adjusts BPM up by 5 when + pressed", () => {
    const onBpmChange = jest.fn();
    const { getByLabelText } = render(
      <Metronome initialBpm={120} onBpmChange={onBpmChange} />,
    );
    fireEvent.press(getByLabelText("Increase BPM by 5"));
    expect(onBpmChange).toHaveBeenCalledWith(125);
  });

  it("adjusts BPM down by 1", () => {
    const onBpmChange = jest.fn();
    const { getByLabelText } = render(
      <Metronome initialBpm={120} onBpmChange={onBpmChange} />,
    );
    fireEvent.press(getByLabelText("Decrease BPM by 1"));
    expect(onBpmChange).toHaveBeenCalledWith(119);
  });

  it("clamps BPM at minimum 30", () => {
    const onBpmChange = jest.fn();
    const { getByLabelText } = render(
      <Metronome initialBpm={32} onBpmChange={onBpmChange} />,
    );
    fireEvent.press(getByLabelText("Decrease BPM by 5"));
    expect(onBpmChange).toHaveBeenCalledWith(30);
  });

  it("renders in compact mode without crashing", () => {
    const { getByText } = render(<Metronome compact />);
    expect(getByText("120")).toBeTruthy();
  });

  it("renders 4 beat dots", () => {
    const { getByLabelText } = render(<Metronome />);
    expect(getByLabelText("4 beats")).toBeTruthy();
  });

  it("renders start button", () => {
    const { getByLabelText } = render(<Metronome />);
    expect(getByLabelText("Start metronome")).toBeTruthy();
  });
});
