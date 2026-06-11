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

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

// Mock expo-image
jest.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock practiceCardUtils
jest.mock("../../client/lib/practiceCardUtils", () => ({
  omrStatusLabel: (status: string) => {
    if (status === "none") return null;
    const map: Record<string, { label: string; variant: string }> = {
      processing: { label: "Scanning\u2026", variant: "processing" },
      ready: { label: "Ready", variant: "ready" },
      failed: { label: "Failed", variant: "failed" },
    };
    return map[status] ?? null;
  },
  formatAccuracy: (acc: number | undefined) =>
    acc === undefined ? null : `${Math.round(acc * 100)}%`,
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

describe("SheetCard — M5 badges", () => {
  it('shows OMR badge with "Ready" for omrStatus "ready"', () => {
    const sheet = makeSheet({ omrStatus: "ready" });
    const { getByTestId, getByText } = render(<SheetCard sheet={sheet} onPress={jest.fn()} />);
    expect(getByTestId("omr-badge")).toBeTruthy();
    expect(getByText("Ready")).toBeTruthy();
  });

  it('shows OMR badge with "Scanning…" for omrStatus "processing"', () => {
    const sheet = makeSheet({ omrStatus: "processing" });
    const { getByTestId, getByText } = render(<SheetCard sheet={sheet} onPress={jest.fn()} />);
    expect(getByTestId("omr-badge")).toBeTruthy();
    expect(getByText("Scanning\u2026")).toBeTruthy();
  });

  it('shows OMR badge with "Failed" for omrStatus "failed"', () => {
    const sheet = makeSheet({ omrStatus: "failed" });
    const { getByTestId, getByText } = render(<SheetCard sheet={sheet} onPress={jest.fn()} />);
    expect(getByTestId("omr-badge")).toBeTruthy();
    expect(getByText("Failed")).toBeTruthy();
  });

  it("shows no OMR badge when omrStatus is 'none'", () => {
    const sheet = makeSheet({ omrStatus: "none" });
    const { queryByTestId } = render(<SheetCard sheet={sheet} onPress={jest.fn()} />);
    expect(queryByTestId("omr-badge")).toBeNull();
  });

  it("shows accuracy chip when lastAccuracy prop is provided", () => {
    const sheet = makeSheet();
    const { getByTestId, getByText } = render(
      <SheetCard sheet={sheet} onPress={jest.fn()} lastAccuracy={0.87} />
    );
    expect(getByTestId("accuracy-chip")).toBeTruthy();
    expect(getByText("87%")).toBeTruthy();
  });

  it("shows no accuracy chip when lastAccuracy is not provided", () => {
    const sheet = makeSheet();
    const { queryByTestId } = render(<SheetCard sheet={sheet} onPress={jest.fn()} />);
    expect(queryByTestId("accuracy-chip")).toBeNull();
  });
});
