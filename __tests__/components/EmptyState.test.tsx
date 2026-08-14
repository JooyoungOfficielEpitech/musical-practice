import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { EmptyState } from "../../client/components/EmptyState";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB",
      backgroundSecondary: "#F8F9FA", buttonText: "#FFF",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

const mockTriggerLight = jest.fn().mockResolvedValue(undefined);
jest.mock("../../client/lib/hapticFeedback", () => ({
  hapticFeedback: { triggerLight: () => mockTriggerLight() },
}));

describe("EmptyState", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders title and message", () => {
    const { getByText } = render(
      <EmptyState icon="musical-notes-outline" title="Nothing here" message="Import something" />
    );
    expect(getByText("Nothing here")).toBeTruthy();
    expect(getByText("Import something")).toBeTruthy();
  });

  it("fires onAction when the action button is pressed", () => {
    const onAction = jest.fn();
    const { getByLabelText } = render(
      <EmptyState
        icon="musical-notes-outline"
        title="Nothing here"
        message="Import something"
        actionLabel="Import PDF"
        onAction={onAction}
      />
    );
    fireEvent.press(getByLabelText("Import PDF"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("action button meets the 44dp minimum touch target", () => {
    const { getByLabelText } = render(
      <EmptyState
        icon="musical-notes-outline"
        title="Nothing here"
        message="Import something"
        actionLabel="Import PDF"
        onAction={jest.fn()}
      />
    );
    const style = StyleSheet.flatten(getByLabelText("Import PDF").props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
