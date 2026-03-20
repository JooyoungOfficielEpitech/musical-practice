import React from "react";
import { render } from "@testing-library/react-native";
import { SheetMusicPager } from "../../client/components/SheetMusicPager";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#FF69B4",
      borderLight: "#FFE8F0",
      backgroundSecondary: "#FFF5F8",
      textSecondary: "#888888",
    },
  }),
}));

// Mock expo-image
jest.mock("expo-image", () => ({
  Image: "Image",
}));

describe("SheetMusicPager", () => {
  it("renders images from imageUris", () => {
    const { toJSON } = render(
      <SheetMusicPager imageUris={["a.jpg", "b.jpg", "c.jpg"]} />,
    );

    const json = JSON.stringify(toJSON());
    expect(json).toContain("a.jpg");
    expect(json).toContain("b.jpg");
    expect(json).toContain("c.jpg");
  });

  it("shows page indicator dots for multiple images", () => {
    const { getAllByTestId } = render(
      <SheetMusicPager imageUris={["a.jpg", "b.jpg", "c.jpg"]} />,
    );

    const dots = getAllByTestId("page-dot");
    expect(dots).toHaveLength(3);
  });

  it("does not show indicator for single image", () => {
    const { queryAllByTestId } = render(
      <SheetMusicPager imageUris={["only.jpg"]} />,
    );

    const dots = queryAllByTestId("page-dot");
    expect(dots).toHaveLength(0);
  });

  it("renders empty state for empty array", () => {
    const { getByText } = render(<SheetMusicPager imageUris={[]} />);

    expect(getByText(/no.*image/i)).toBeTruthy();
  });
});
