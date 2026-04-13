import AsyncStorage from "@react-native-async-storage/async-storage";

export const ONBOARDING_KEY = "@musicalpractice/onboarding_complete";

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  } catch {
    // silently fail — non-critical
  }
}
