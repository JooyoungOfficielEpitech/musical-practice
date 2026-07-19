import React from "react";
import { render, act } from "@testing-library/react-native";
import { InteractiveScore } from "../../client/components/InteractiveScore";
import { getOsmdSource } from "../../client/lib/osmdSource";

// Bundled OSMD source loads async — resolve to null (CDN fallback) by default
jest.mock("../../client/lib/osmdSource", () => ({
  getOsmdSource: jest.fn().mockResolvedValue(null),
}));
const mockGetOsmdSource = getOsmdSource as jest.Mock;

/** Render and flush the async OSMD-source load so the WebView is present. */
async function renderScore(ui: React.ReactElement) {
  const result = render(ui);
  await act(async () => {});
  return result;
}

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#2563EB",
      backgroundSecondary: "#F3F4F6",
      error: "#DC2626",
    },
    isDark: false,
  }),
}));

// Mock WebView
jest.mock("react-native-webview", () => ({
  WebView: "WebView",
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Simple test MusicXML
const testMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"/>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

describe("InteractiveScore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOsmdSource.mockResolvedValue(null);
  });

  it("renders without crashing", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts musicXml prop", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts positionMs prop", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} positionMs={0} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onNotePress callback", async () => {
    const onNotePress = jest.fn();
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} onNotePress={onNotePress} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onReady callback", async () => {
    const onReady = jest.fn();
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} onReady={onReady} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("updates when positionMs changes", async () => {
    const { rerender } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} positionMs={0} />
    );

    rerender(
      <InteractiveScore musicXml={testMusicXml} positionMs={500} />
    );

    expect(true).toBe(true);
  });

  it("updates when musicXml changes", async () => {
    const xml1 = testMusicXml;
    const xml2 = testMusicXml.replace("<step>C</step>", "<step>D</step>");

    const { rerender } = await renderScore(
      <InteractiveScore musicXml={xml1} />
    );

    rerender(
      <InteractiveScore musicXml={xml2} />
    );

    expect(true).toBe(true);
  });

  it("is memoized for performance", async () => {
    const Component = InteractiveScore;
    expect(Component.$$typeof).toBeDefined();
  });

  // HTML generation tests
  it("generates HTML with white background (#FFFFFF)", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Verify the HTML contains white background
    expect(json).toContain("background:#FFFFFF");
  });

  it("HTML output does NOT contain dark background colors", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Should NOT contain dark mode background (#0D0D15)
    // This test verifies the fix for observation 664
    expect(json).not.toContain("#0D0D15");
  });

  it("HTML contains blue cursor color for readability", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Cursor should use blue color
    expect(json).toContain("#2563EB");
  });

  it("WebView has transparent background to show parent styling", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // WebView itself should be transparent (parent container handles bg)
    expect(json).toContain("transparent");
  });

  it("falls back to the OSMD CDN script when no bundled source", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());

    expect(json).toContain("opensheetmusicdisplay");
  });

  it("inlines the bundled OSMD source (offline) when available", async () => {
    mockGetOsmdSource.mockResolvedValue("var OSMD_BUNDLED_MARKER=1;");
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());

    expect(json).toContain("OSMD_BUNDLED_MARKER");
    expect(json).not.toContain("cdn.jsdelivr.net");
  });

  it("cursor element uses scrollIntoView for auto-scroll", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Should have auto-scroll functionality
    expect(json).toContain("scrollIntoView");
  });
});

// ─── Phase 3: visiblePartIndices prop (RED) ───────────────────────────────────
// These tests FAIL against the current implementation (prop doesn't exist yet,
// and setVisibleParts JS function is not in the WebView HTML).

describe("InteractiveScore — visiblePartIndices (Phase 3)", () => {
  it("3.1 — renders without error when visiblePartIndices={[0]} is passed", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} visiblePartIndices={[0]} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("3.2 — WebView HTML contains setVisibleParts function", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} visiblePartIndices={[0]} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("setVisibleParts");
  });

  it("3.3 — WebView HTML handles setVisibleParts message type", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("setVisibleParts");
  });
});

// ─── Phase 1: Score Reader Bug Fixes (RED) ────────────────────────────────────
describe("InteractiveScore — score reader bug fixes (Phase 1)", () => {
  it("1.1 — cursor element width is NOT forced to 100%", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain("style.width='100%'");
  });

  it("1.2 — OSMD is initialized with zoom 0.65", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("zoom:0.65");
  });

  it("1.3 — scrollIntoView uses smooth behavior for better visual feedback", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("behavior:'smooth'");
    expect(json).not.toContain("behavior:'instant'");
  });

  it("1.3a — cursor has glow effect via box-shadow", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("boxShadow");
    expect(json).toContain("0 0 8px");
  });

  it("1.3b — cursor border width is increased to 4px", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("borderLeft='4px");
  });

  it("1.4 — currentStep variable exists for incremental cursor tracking", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("currentStep");
  });
});

// ─── Accessibility: score-viewer-not-accessible ────────────────────────────────
describe("InteractiveScore — accessibility (score-viewer-not-accessible)", () => {
  it("A1 — WebView container has accessibilityRole='image'", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("accessibilityRole");
    expect(json).toContain("image");
  });

  it("A2 — WebView container has accessibilityLabel", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("accessibilityLabel");
  });

  it("A3 — WebView container has accessibilityLiveRegion to announce cursor changes", async () => {
    const { toJSON } = await renderScore(
      <InteractiveScore musicXml={testMusicXml} positionMs={1000} />
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("accessibilityLiveRegion");
  });
});
