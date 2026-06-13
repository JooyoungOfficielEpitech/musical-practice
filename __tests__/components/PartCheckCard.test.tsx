import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import { PartCheckCard } from "../../client/components/PartCheckCard";
import type { PartInfo } from "../../client/types/music";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      surface: "#fff",
      text: "#000",
      textSecondary: "#666",
      primary: "#2563EB",
      borderLight: "#eee",
    },
    isDark: false,
  }),
}));

const PARTS: PartInfo[] = [
  { id: "P1", name: "Soprano", partIndex: 0 },
  { id: "P2", name: "Alto", partIndex: 1 },
];
const COUNTS = { P1: 120, P2: 80 };

describe("PartCheckCard", () => {
  it("renders nothing when there are no parts", () => {
    const { toJSON } = render(
      <PartCheckCard parts={[]} visiblePartIds={new Set()} partNoteCounts={{}} onTogglePart={() => {}} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("lists every part name with its note count", () => {
    render(
      <PartCheckCard parts={PARTS} visiblePartIds={new Set(["P1", "P2"])} partNoteCounts={COUNTS} onTogglePart={() => {}} />,
    );
    expect(screen.getByText("Soprano")).toBeTruthy();
    expect(screen.getByText("Alto")).toBeTruthy();
    expect(screen.getByText("120 notes")).toBeTruthy();
    expect(screen.getByText("80 notes")).toBeTruthy();
  });

  it("reflects checked state from visiblePartIds", () => {
    render(
      <PartCheckCard parts={PARTS} visiblePartIds={new Set(["P1"])} partNoteCounts={COUNTS} onTogglePart={() => {}} />,
    );
    expect(screen.getByLabelText("Soprano").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("Alto").props.accessibilityState.checked).toBe(false);
  });

  it("toggles a part when tapped", () => {
    const onToggle = jest.fn();
    render(
      <PartCheckCard parts={PARTS} visiblePartIds={new Set(["P1", "P2"])} partNoteCounts={COUNTS} onTogglePart={onToggle} />,
    );
    fireEvent.press(screen.getByLabelText("Alto"));
    expect(onToggle).toHaveBeenCalledWith("P2");
  });

  it("does not let the user deselect the last remaining part", () => {
    const onToggle = jest.fn();
    render(
      <PartCheckCard parts={PARTS} visiblePartIds={new Set(["P1"])} partNoteCounts={COUNTS} onTogglePart={onToggle} />,
    );
    // P1 is the only visible part — tapping it must not fire a toggle
    fireEvent.press(screen.getByLabelText("Soprano"));
    expect(onToggle).not.toHaveBeenCalled();
    // A non-visible part can still be turned on
    fireEvent.press(screen.getByLabelText("Alto"));
    expect(onToggle).toHaveBeenCalledWith("P2");
  });

  it("renders a single-part score without toggles", () => {
    render(
      <PartCheckCard
        parts={[{ id: "P1", name: "Hermes", partIndex: 0 }]}
        visiblePartIds={new Set(["P1"])}
        partNoteCounts={{ P1: 200 }}
        onTogglePart={() => {}}
      />,
    );
    expect(screen.getByText("Hermes")).toBeTruthy();
    expect(screen.getByText("200 notes")).toBeTruthy();
  });
});
