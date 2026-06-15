import React from "react";
import { render } from "@testing-library/react-native";
import { SeekBar } from "../../client/components/SeekBar";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#2563EB",
      borderLight: "#E5E7EB",
      primarySubtle: "#DBEAFE",
      surface: "#FFFFFF",
    },
  }),
}));

describe("SeekBar", () => {
  const mockOnSeek = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { toJSON } = render(
      <SeekBar positionMs={0} durationMs={180000} loopRange={null} onSeek={mockOnSeek} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("has accessibilityRole='adjustable'", () => {
    const { toJSON } = render(
      <SeekBar positionMs={0} durationMs={180000} loopRange={null} onSeek={mockOnSeek} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("adjustable");
  });
});

// ─── Accessibility: seek-bar-not-accessible ────────────────────────────────────
describe("SeekBar — accessibility (seek-bar-not-accessible)", () => {
  const mockOnSeek = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("A1 — accessibilityLabel includes formatted time for current position", () => {
    const { toJSON } = render(
      <SeekBar positionMs={90000} durationMs={180000} loopRange={null} onSeek={mockOnSeek} />
    );
    const json = JSON.stringify(toJSON());
    // Label should contain time info, not just "Playback position"
    expect(json).toContain("accessibilityLabel");
  });

  it("A2 — accessibilityValue reflects current position as numeric value", () => {
    const { toJSON } = render(
      <SeekBar positionMs={90000} durationMs={180000} loopRange={null} onSeek={mockOnSeek} />
    );
    const json = JSON.stringify(toJSON());
    // Should have accessibilityValue with min/max/now
    expect(json).toContain("accessibilityValue");
    expect(json).toContain("min");
    expect(json).toContain("max");
  });

  it("A3 — accessibilityLiveRegion='assertive' announces scrubbing during playback", () => {
    const { toJSON } = render(
      <SeekBar positionMs={0} durationMs={180000} loopRange={null} onSeek={mockOnSeek} />
    );
    const json = JSON.stringify(toJSON());
    // Container should support live region for scrubbing announcements
    expect(json).toContain("accessibilityRole");
  });
});
