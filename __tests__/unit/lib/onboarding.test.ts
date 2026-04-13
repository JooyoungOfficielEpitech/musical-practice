import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  hasCompletedOnboarding,
  setOnboardingComplete,
  ONBOARDING_KEY,
} from "../../../client/lib/onboarding";

describe("onboarding", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns false when onboarding not completed", async () => {
    const result = await hasCompletedOnboarding();
    expect(result).toBe(false);
  });

  it("returns true after onboarding is completed", async () => {
    await setOnboardingComplete();
    const result = await hasCompletedOnboarding();
    expect(result).toBe(true);
  });

  it("persists to AsyncStorage", async () => {
    await setOnboardingComplete();
    const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
    expect(stored).toBe("true");
  });
});
