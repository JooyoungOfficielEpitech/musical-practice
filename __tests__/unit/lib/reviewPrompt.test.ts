import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  shouldRequestReview,
  markReviewRequested,
} from "../../../client/lib/reviewPrompt";

describe("reviewPrompt", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("should not request review if fewer than 3 sessions", async () => {
    const result = await shouldRequestReview(2, 80);
    expect(result).toBe(false);
  });

  it("should not request review if accuracy below 70", async () => {
    const result = await shouldRequestReview(5, 50);
    expect(result).toBe(false);
  });

  it("should request review if 3+ sessions and 70+ accuracy", async () => {
    const result = await shouldRequestReview(3, 70);
    expect(result).toBe(true);
  });

  it("should not request review if already requested within 7 days", async () => {
    await markReviewRequested();
    const result = await shouldRequestReview(10, 90);
    expect(result).toBe(false);
  });

  it("should request review if last request was over 7 days ago", async () => {
    // Simulate a request 8 days ago
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(
      "@musicalpractice/last_review_request",
      String(eightDaysAgo),
    );
    const result = await shouldRequestReview(5, 80);
    expect(result).toBe(true);
  });
});
