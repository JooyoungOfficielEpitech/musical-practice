import React from "react";
import { render } from "@testing-library/react-native";
import { LivePitchBadge } from "../../client/components/LivePitchBadge";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: { success: "#15803D", error: "#DC2626", buttonText: "#FFFFFF" },
  }),
}));

const basePitch = { frequency: 440, note: "A", octave: 4, cents: 0, clarity: 0.9, correct: true };

describe("LivePitchBadge", () => {
  it("renders nothing when no pitch is detected", () => {
    const { queryByTestId } = render(<LivePitchBadge pitch={null} accuracyPercent={0} />);
    expect(queryByTestId("pitch-badge")).toBeNull();
  });

  it("shows the detected note, cents offset, and running accuracy", () => {
    const { getByText } = render(
      <LivePitchBadge pitch={{ ...basePitch, cents: 25 }} accuracyPercent={84} />,
    );
    expect(getByText("A4")).toBeTruthy();
    expect(getByText("+25¢")).toBeTruthy();
    expect(getByText("84%")).toBeTruthy();
  });

  it("shows negative cents when flat", () => {
    const { getByText } = render(
      <LivePitchBadge pitch={{ ...basePitch, cents: -15 }} accuracyPercent={50} />,
    );
    expect(getByText("-15¢")).toBeTruthy();
  });

  it("colors the badge by correctness", () => {
    const correct = render(<LivePitchBadge pitch={basePitch} accuracyPercent={100} />);
    expect(correct.getByTestId("pitch-badge")).toHaveStyle({ backgroundColor: "#15803D" });

    const wrong = render(
      <LivePitchBadge pitch={{ ...basePitch, correct: false }} accuracyPercent={20} />,
    );
    expect(wrong.getByTestId("pitch-badge")).toHaveStyle({ backgroundColor: "#DC2626" });
  });

  it("announces state for screen readers", () => {
    const { getByLabelText } = render(
      <LivePitchBadge pitch={{ ...basePitch, correct: false }} accuracyPercent={42} />,
    );
    expect(getByLabelText("Singing A4, off pitch, accuracy 42 percent")).toBeTruthy();
  });
});
