import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PartSelectorBottomSheet } from "../../client/components/PartSelectorBottomSheet";
import type { PartInfo } from "../../client/types/music";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB",
      backgroundDefault: "#FFF", surface: "#F8F9FA", backgroundSecondary: "#F8F9FA",
      borderLight: "#F3F4F6", buttonText: "#FFF", error: "#DC2626",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: (props: { name: string; testID?: string }) => {
    const { Text } = require("react-native");
    return <Text testID={props.testID ?? `icon-${props.name}`}>{props.name}</Text>;
  },
}));

const TWO_PARTS: PartInfo[] = [
  { id: "P1", name: "Violin", partIndex: 0 },
  { id: "P2", name: "Piano", partIndex: 1 },
];

const ONE_PART: PartInfo[] = [
  { id: "P1", name: "Piano", partIndex: 0 },
];

describe("PartSelectorBottomSheet", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── Phase 4 tests (RED) ──────────────────────────────────────────────────

  it("4.1 — renders each part name when visible=true", () => {
    const { getByText } = render(
      <PartSelectorBottomSheet
        visible={true}
        onDismiss={jest.fn()}
        parts={TWO_PARTS}
        visiblePartIds={new Set(["P1", "P2"])}
        onTogglePart={jest.fn()}
      />
    );
    expect(getByText("Violin")).toBeTruthy();
    expect(getByText("Piano")).toBeTruthy();
  });

  it("4.2 — pressing a part row calls onTogglePart with correct id", () => {
    const onTogglePart = jest.fn();
    const { getByText } = render(
      <PartSelectorBottomSheet
        visible={true}
        onDismiss={jest.fn()}
        parts={TWO_PARTS}
        visiblePartIds={new Set(["P1", "P2"])}
        onTogglePart={onTogglePart}
      />
    );
    fireEvent.press(getByText("Violin"));
    expect(onTogglePart).toHaveBeenCalledWith("P1");
  });

  it("4.3 — shows checkmark-circle for visible parts and ellipse-outline for hidden", () => {
    const { getByTestId } = render(
      <PartSelectorBottomSheet
        visible={true}
        onDismiss={jest.fn()}
        parts={TWO_PARTS}
        visiblePartIds={new Set(["P1"])}
        onTogglePart={jest.fn()}
      />
    );
    expect(getByTestId("icon-P1")).toBeTruthy();
    expect(getByTestId("icon-P2")).toBeTruthy();
    // P1 is visible → checkmark-circle; P2 is hidden → ellipse-outline
    const p1Icon = getByTestId("icon-P1");
    const p2Icon = getByTestId("icon-P2");
    expect(p1Icon.props.children).toBe("checkmark-circle");
    expect(p2Icon.props.children).toBe("ellipse-outline");
  });

  it("4.4 — shows 'Single part score' message when only 1 part", () => {
    const { getByText, queryByText } = render(
      <PartSelectorBottomSheet
        visible={true}
        onDismiss={jest.fn()}
        parts={ONE_PART}
        visiblePartIds={new Set(["P1"])}
        onTogglePart={jest.fn()}
      />
    );
    expect(getByText("Single part score")).toBeTruthy();
    // The single part name should NOT be rendered as a pressable toggle row
    expect(queryByText("Piano")).toBeNull();
  });

  it("4.5 — onDismiss called on close button press", () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = render(
      <PartSelectorBottomSheet
        visible={true}
        onDismiss={onDismiss}
        parts={TWO_PARTS}
        visiblePartIds={new Set(["P1", "P2"])}
        onTogglePart={jest.fn()}
      />
    );
    fireEvent.press(getByLabelText("Close parts selector"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
