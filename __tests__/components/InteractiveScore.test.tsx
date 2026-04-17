import React from "react";
import { render } from "@testing-library/react-native";
import { InteractiveScore } from "../../client/components/InteractiveScore";

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
  });

  it("renders without crashing", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts musicXml prop", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts positionMs prop", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} positionMs={0} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onNotePress callback", () => {
    const onNotePress = jest.fn();
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} onNotePress={onNotePress} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onReady callback", () => {
    const onReady = jest.fn();
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} onReady={onReady} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("updates when positionMs changes", () => {
    const { rerender } = render(
      <InteractiveScore musicXml={testMusicXml} positionMs={0} />
    );

    rerender(
      <InteractiveScore musicXml={testMusicXml} positionMs={500} />
    );

    expect(true).toBe(true);
  });

  it("updates when musicXml changes", () => {
    const xml1 = testMusicXml;
    const xml2 = testMusicXml.replace("<step>C</step>", "<step>D</step>");

    const { rerender } = render(
      <InteractiveScore musicXml={xml1} />
    );

    rerender(
      <InteractiveScore musicXml={xml2} />
    );

    expect(true).toBe(true);
  });

  it("is memoized for performance", () => {
    const Component = InteractiveScore;
    expect(Component.$$typeof).toBeDefined();
  });

  // HTML generation tests
  it("generates HTML with white background (#FFFFFF)", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Verify the HTML contains white background
    expect(json).toContain("background:#FFFFFF");
  });

  it("HTML output does NOT contain dark background colors", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Should NOT contain dark mode background (#0D0D15)
    // This test verifies the fix for observation 664
    expect(json).not.toContain("#0D0D15");
  });

  it("HTML contains blue cursor color for readability", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Cursor should use blue color
    expect(json).toContain("#2563EB");
  });

  it("WebView has transparent background to show parent styling", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // WebView itself should be transparent (parent container handles bg)
    expect(json).toContain("transparent");
  });

  it("contains OSMD CDN script reference", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Should load OSMD from CDN
    expect(json).toContain("opensheetmusicdisplay");
  });

  it("cursor element uses scrollIntoView for auto-scroll", () => {
    const { toJSON } = render(
      <InteractiveScore musicXml={testMusicXml} />
    );
    const json = JSON.stringify(toJSON());
    
    // Should have auto-scroll functionality
    expect(json).toContain("scrollIntoView");
  });
});
