import { generateShareText, getScoreEmoji } from "../../../client/lib/shareCard";

describe("shareCard", () => {
  describe("getScoreEmoji", () => {
    it("returns fire emoji for >= 90", () => {
      expect(getScoreEmoji(95)).toBe("🔥");
    });

    it("returns star emoji for >= 70", () => {
      expect(getScoreEmoji(75)).toBe("⭐");
    });

    it("returns muscle emoji for >= 50", () => {
      expect(getScoreEmoji(55)).toBe("💪");
    });

    it("returns seedling emoji for < 50", () => {
      expect(getScoreEmoji(30)).toBe("🌱");
    });
  });

  describe("generateShareText", () => {
    it("includes accuracy", () => {
      const text = generateShareText({ accuracy: 85, duration: 600, streak: 5 });
      expect(text).toContain("85%");
    });

    it("includes duration in minutes", () => {
      const text = generateShareText({ accuracy: 85, duration: 600, streak: 5 });
      expect(text).toContain("10");
    });

    it("includes streak", () => {
      const text = generateShareText({ accuracy: 85, duration: 600, streak: 5 });
      expect(text).toContain("5");
    });

    it("includes app name", () => {
      const text = generateShareText({ accuracy: 85, duration: 600, streak: 5 });
      expect(text.toLowerCase()).toContain("musical practice");
    });
  });
});
