/**
 * Tests for SessionCompleteToast component
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { SessionCompleteToast } from "../../client/components/SessionCompleteToast";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      success: "#15803D",
      buttonText: "#FAFAF9",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("SessionCompleteToast", () => {
  it("should render with duration text", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={600} />);
    expect(getByText("Practiced 10m")).toBeTruthy();
  });

  it("should format duration in minutes only when under 1 hour", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={1200} />);
    expect(getByText("Practiced 20m")).toBeTruthy();
  });

  it("should format duration in hours and minutes when over 1 hour", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={5400} />);
    expect(getByText("Practiced 1h 30m")).toBeTruthy();
  });

  it("should display accuracy when provided", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={300} accuracy={0.85} />);
    expect(getByText("85% accuracy")).toBeTruthy();
  });

  it("should not display accuracy line when accuracy is undefined", () => {
    const { queryByText } = render(<SessionCompleteToast durationSec={300} />);
    expect(queryByText(/accuracy/)).toBeNull();
  });

  it("should round accuracy to nearest percent", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={300} accuracy={0.847} />);
    expect(getByText("85% accuracy")).toBeTruthy();
  });

  it("should display 100% accuracy when accuracy is 1.0", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={300} accuracy={1.0} />);
    expect(getByText("100% accuracy")).toBeTruthy();
  });

  it("should display 0% accuracy when accuracy is 0", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={300} accuracy={0} />);
    expect(getByText("0% accuracy")).toBeTruthy();
  });

  it("should render main duration text", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={300} />);
    expect(getByText("Practiced 5m")).toBeTruthy();
  });

  it("should handle very short sessions", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={30} />);
    expect(getByText("Practiced 0m")).toBeTruthy();
  });

  it("should handle long sessions", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={86400} />);
    expect(getByText("Practiced 24h 0m")).toBeTruthy();
  });

  it("should display both duration and accuracy together", () => {
    const { getByText } = render(<SessionCompleteToast durationSec={600} accuracy={0.92} />);
    expect(getByText("Practiced 10m")).toBeTruthy();
    expect(getByText("92% accuracy")).toBeTruthy();
  });
});
