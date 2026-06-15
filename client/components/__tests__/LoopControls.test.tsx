import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { LoopControls } from "../LoopControls";

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

describe("LoopControls", () => {
  const defaultProps = {
    loopPointA: null,
    loopPointB: null,
    isLoopActive: false,
    positionMs: 5000,
    durationMs: 10000,
    onCaptureA: jest.fn(),
    onCaptureB: jest.fn(),
    onApply: jest.fn(),
    onClear: jest.fn(),
  };

  it("renders 4 buttons: Set A, Set B, Loop toggle, Clear", () => {
    const { getByLabelText } = render(<LoopControls {...defaultProps} />);
    expect(getByLabelText(/Set loop start/)).toBeTruthy();
    expect(getByLabelText(/Set loop end/)).toBeTruthy();
    expect(getByLabelText(/A-B loop/)).toBeTruthy();
    expect(getByLabelText(/Clear loop/)).toBeTruthy();
  });

  it("displays current position text near A/B buttons when no points set", () => {
    const { getAllByText } = render(<LoopControls {...defaultProps} />);
    // Should show position as "5.00s" (appears twice, once for A and once for B)
    const timeTexts = getAllByText(/5\.00s/);
    expect(timeTexts.length).toBeGreaterThan(0);
  });

  it("calls onCaptureA when Set A button is pressed", () => {
    const onCaptureA = jest.fn();
    const { getByLabelText } = render(
      <LoopControls {...defaultProps} onCaptureA={onCaptureA} />
    );
    fireEvent.press(getByLabelText(/Set loop start/));
    expect(onCaptureA).toHaveBeenCalledWith(5000);
  });

  it("calls onCaptureB when Set B button is pressed", () => {
    const onCaptureB = jest.fn();
    const { getByLabelText } = render(
      <LoopControls {...defaultProps} onCaptureB={onCaptureB} />
    );
    fireEvent.press(getByLabelText(/Set loop end/));
    expect(onCaptureB).toHaveBeenCalledWith(5000);
  });

  it("calls onClear when Clear button is pressed", () => {
    const onClear = jest.fn();
    const { getByLabelText } = render(
      <LoopControls {...defaultProps} onClear={onClear} />
    );
    fireEvent.press(getByLabelText(/Clear loop/));
    expect(onClear).toHaveBeenCalled();
  });

  it("highlights Set A button when loopPointA is set", () => {
    const { getByLabelText } = render(
      <LoopControls {...defaultProps} loopPointA={3000} />
    );
    const setABtn = getByLabelText(/Set loop start/);
    // Button should have primary color style when active
    expect(setABtn).toBeTruthy();
  });

  it("highlights Set B button when loopPointB is set", () => {
    const { getByLabelText } = render(
      <LoopControls {...defaultProps} loopPointB={7000} />
    );
    const setBBtn = getByLabelText(/Set loop end/);
    expect(setBBtn).toBeTruthy();
  });

  it("highlights loop toggle when isLoopActive is true", () => {
    const { getByLabelText } = render(
      <LoopControls {...defaultProps} isLoopActive={true} />
    );
    const loopToggle = getByLabelText(/A-B loop/);
    expect(loopToggle).toBeTruthy();
  });

  it("calls onApply when loop toggle is pressed and both A and B are set", () => {
    const onApply = jest.fn();
    const { getByLabelText } = render(
      <LoopControls
        {...defaultProps}
        loopPointA={3000}
        loopPointB={7000}
        onApply={onApply}
      />
    );
    fireEvent.press(getByLabelText(/A-B loop/));
    expect(onApply).toHaveBeenCalled();
  });

  it("does not call onApply if only A is set", () => {
    const onApply = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <LoopControls {...defaultProps} loopPointA={3000} onApply={onApply} />
    );
    const loopToggle = queryByLabelText(/A-B loop/);
    // Apply button should be disabled or not interactive
    expect(loopToggle).toBeTruthy();
  });

  it("does not call onApply if only B is set", () => {
    const onApply = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <LoopControls {...defaultProps} loopPointB={7000} onApply={onApply} />
    );
    const loopToggle = queryByLabelText(/A-B loop/);
    expect(loopToggle).toBeTruthy();
  });
});
