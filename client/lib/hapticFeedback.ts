import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export const hapticFeedback = {
  triggerLight: async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Silently ignore haptic errors in test or unsupported environments
      }
    }
  },

  triggerMedium: async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Silently ignore haptic errors in test or unsupported environments
      }
    }
  },

  triggerHeavy: async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {
        // Silently ignore haptic errors in test or unsupported environments
      }
    }
  },
};
