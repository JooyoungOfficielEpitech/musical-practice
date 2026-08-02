import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { VolumeSlider } from "../../client/components/VolumeSlider";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#000", textSecondary: "#666", primary: "#2563EB",
      borderLight: "#eee", surface: "#fff",
    },
  }),
}));

describe("VolumeSlider", () => {
  it("exposes the current volume as an adjustable accessibility value", () => {
    const { getByLabelText } = render(
      <VolumeSlider value={0.6} onChange={jest.fn()} accessibilityLabel="Soprano volume" />,
    );
    const slider = getByLabelText("Soprano volume");
    expect(slider.props.accessibilityValue).toEqual({ now: 60, min: 0, max: 100 });
    expect(slider.props.accessibilityRole).toBe("adjustable");
  });

  it("increments and decrements by 10% via accessibility actions", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <VolumeSlider value={0.6} onChange={onChange} accessibilityLabel="Soprano volume" />,
    );
    const slider = getByLabelText("Soprano volume");

    fireEvent(slider, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(onChange).toHaveBeenCalledWith(0.7);
    fireEvent(slider, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("clamps accessibility adjustments to the 0..1 range", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <VolumeSlider value={1} onChange={onChange} accessibilityLabel="Soprano volume" />,
    );
    fireEvent(getByLabelText("Soprano volume"), "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
