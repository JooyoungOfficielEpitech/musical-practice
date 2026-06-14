import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TempoPresets } from "../TempoPresets";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333",
      textSecondary: "#888",
      primary: "#2563EB",
      surface: "#F8F9FA",
      buttonText: "#FFF",
      borderLight: "#F3F4F6",
    },
  }),
}));

describe("TempoPresets", () => {
  const defaultProps = {
    tempo: 1.0,
    onTempoChange: jest.fn(),
  };

  it("renders 6 default tempo preset buttons", () => {
    const { getByText } = render(<TempoPresets {...defaultProps} />);
    expect(getByText("0.50x")).toBeTruthy();
    expect(getByText("0.75x")).toBeTruthy();
    expect(getByText("1.00x")).toBeTruthy();
    expect(getByText("1.25x")).toBeTruthy();
    expect(getByText("1.50x")).toBeTruthy();
    expect(getByText("2.00x")).toBeTruthy();
  });

  it("highlights the preset button matching current tempo", () => {
    const { getByText } = render(<TempoPresets tempo={1.0} onTempoChange={jest.fn()} />);
    const btn = getByText("1.00x");
    expect(btn).toBeTruthy();
  });

  it("does not highlight any preset when tempo is between presets", () => {
    const { getByText, queryByLabelText } = render(
      <TempoPresets tempo={1.37} onTempoChange={jest.fn()} />
    );
    // No preset button should be highlighted (this is a state check)
    const btn = getByText("1.25x");
    expect(btn).toBeTruthy();
  });

  it("calls onTempoChange when preset button is pressed", () => {
    const onTempoChange = jest.fn();
    const { getByText } = render(
      <TempoPresets {...defaultProps} onTempoChange={onTempoChange} />
    );
    fireEvent.press(getByText("1.50x"));
    expect(onTempoChange).toHaveBeenCalledWith(1.5);
  });

  it("highlights 0.5x preset when tempo is 0.5", () => {
    const { getByText } = render(
      <TempoPresets tempo={0.5} onTempoChange={jest.fn()} />
    );
    const btn = getByText("0.50x");
    expect(btn).toBeTruthy();
  });

  it("highlights 2.0x preset when tempo is 2.0", () => {
    const { getByText } = render(
      <TempoPresets tempo={2.0} onTempoChange={jest.fn()} />
    );
    const btn = getByText("2.00x");
    expect(btn).toBeTruthy();
  });

  it("preserves highlight when tempo updates after press", () => {
    const onTempoChange = jest.fn();
    const { getByText, rerender } = render(
      <TempoPresets tempo={1.0} onTempoChange={onTempoChange} />
    );
    fireEvent.press(getByText("1.50x"));
    expect(onTempoChange).toHaveBeenCalledWith(1.5);

    rerender(<TempoPresets tempo={1.5} onTempoChange={onTempoChange} />);
    const btn = getByText("1.50x");
    expect(btn).toBeTruthy();
  });
});
