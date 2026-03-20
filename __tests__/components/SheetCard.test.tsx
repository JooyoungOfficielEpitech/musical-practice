import React from "react";
import { render } from "@testing-library/react-native";
import { SheetCard } from "../../client/components/SheetCard";
import type { SheetMusic } from "../../client/lib/storage";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333333",
      textSecondary: "#888888",
      primary: "#FF69B4",
      surface: "#FFF5F8",
      backgroundSecondary: "#FFF5F8",
      borderLight: "#FFE8F0",
      error: "#FF6B6B",
      accent: "#9B59B6",
      buttonText: "#FFFFFF",
      primaryDark: "#E0559E",
    },
  }),
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock expo-image
jest.mock("expo-image", () => ({
  Image: "Image",
}));

function makeSheet(overrides: Partial<SheetMusic> = {}): SheetMusic {
  return {
    id: "1",
    title: "Test Song",
    artist: "Test Artist",
    imageUris: ["img1.jpg"],
    createdAt: Date.now(),
    folder: "Musical",
    isFavorite: false,
    ...overrides,
  };
}

describe("SheetCard", () => {
  const onPress = jest.fn();

  it("renders with first image from imageUris", () => {
    const sheet = makeSheet({ imageUris: ["first.jpg", "second.jpg"] });
    const { toJSON } = render(<SheetCard sheet={sheet} onPress={onPress} />);

    // The Image source should use imageUris[0]
    const json = JSON.stringify(toJSON());
    expect(json).toContain("first.jpg");
  });

  it("shows page count badge when multiple images", () => {
    const sheet = makeSheet({ imageUris: ["a.jpg", "b.jpg", "c.jpg"] });
    const { getByText } = render(<SheetCard sheet={sheet} onPress={onPress} />);

    expect(getByText("3")).toBeTruthy();
  });

  it("does not show page count badge for single image", () => {
    const sheet = makeSheet({ imageUris: ["only.jpg"] });
    const { queryByText } = render(<SheetCard sheet={sheet} onPress={onPress} />);

    // Should not have a page count badge (no "1" badge)
    // Check that there's no standalone "1" text that could be a badge
    // The component should not render a badge at all for single image
    const json = JSON.stringify(render(<SheetCard sheet={sheet} onPress={onPress} />).toJSON());
    expect(json).not.toContain("pages-badge");
  });

  it("shows audio icon when audioUri exists", () => {
    const sheet = makeSheet({ audioUri: "song.mp3" });
    const { toJSON } = render(<SheetCard sheet={sheet} onPress={onPress} />);

    const json = JSON.stringify(toJSON());
    // Should contain a music/audio icon indicator
    expect(json).toContain("musical-note");
  });
});
