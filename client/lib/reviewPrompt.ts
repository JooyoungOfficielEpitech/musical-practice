import AsyncStorage from "@react-native-async-storage/async-storage";

const REVIEW_REQUEST_KEY = "@musicalpractice/last_review_request";
const MIN_SESSIONS = 3;
const MIN_ACCURACY = 70;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function shouldRequestReview(
  totalSessions: number,
  accuracy: number,
): Promise<boolean> {
  if (totalSessions < MIN_SESSIONS) return false;
  if (accuracy < MIN_ACCURACY) return false;

  try {
    const lastRequest = await AsyncStorage.getItem(REVIEW_REQUEST_KEY);
    if (lastRequest) {
      const elapsed = Date.now() - Number(lastRequest);
      if (elapsed < COOLDOWN_MS) return false;
    }
  } catch {
    // If storage fails, allow the request
  }

  return true;
}

export async function markReviewRequested(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_REQUEST_KEY, String(Date.now()));
  } catch {
    // silently fail
  }
}

export async function requestStoreReview(): Promise<void> {
  try {
    const StoreReview = await import("expo-store-review");
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      await markReviewRequested();
    }
  } catch {
    // Store review not available
  }
}
