import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MetronomeBottomSheet } from "../../client/components/MetronomeBottomSheet";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB",
      backgroundDefault: "#FFF", surface: "#F8F9FA", backgroundSecondary: "#F8F9FA",
      borderLight: "#F3F4F6", buttonText: "#FFF", error: "#DC2626",
    },
  }),
}));

jest.mock("../../client/components/Metronome", () => ({
  Metronome: (props: { initialBpm?: number }) => {
    const { View, Text } = require("react-native");
    return (
      <View testID="metronome-mock">
        <Text>{props.initialBpm ?? 120}</Text>
      </View>
    );
  },
}));

describe("MetronomeBottomSheet", () => {
  const defaultProps = {
    visible: true,
    onDismiss: jest.fn(),
    initialBpm: 100,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders with testID when visible", () => {
    const { getByTestId } = render(<MetronomeBottomSheet {...defaultProps} />);
    expect(getByTestId("metronome-bottom-sheet")).toBeTruthy();
  });

  it("does not render content when not visible", () => {
    const { queryByTestId } = render(
      <MetronomeBottomSheet {...defaultProps} visible={false} />
    );
    expect(queryByTestId("metronome-bottom-sheet")).toBeNull();
  });

  it("renders Metronome component inside the sheet", () => {
    const { getByTestId } = render(<MetronomeBottomSheet {...defaultProps} />);
    expect(getByTestId("metronome-mock")).toBeTruthy();
  });

  it("passes initialBpm to Metronome", () => {
    const { getByText } = render(<MetronomeBottomSheet {...defaultProps} />);
    expect(getByText("100")).toBeTruthy();
  });

  it("calls onDismiss when close button is pressed", () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = render(
      <MetronomeBottomSheet {...defaultProps} onDismiss={onDismiss} />
    );
    fireEvent.press(getByLabelText("Close metronome"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
