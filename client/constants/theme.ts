import { Platform } from "react-native";

// "Sheet & ink" palette. Light mode reads like warm manuscript paper with ink
// CTAs; dark mode is a true-black stage with amber accent. Buttons always pair
// `primary` with `buttonText` (ink↔paper inversion between modes).
export const Colors = {
  light: {
    text: "#1C1917",
    // 4.9:1 on the F4F1EC secondary surface — #78716C fell just under AA (4.1).
    textSecondary: "#6B6560",
    buttonText: "#FAFAF9",
    tabIconDefault: "#A8A29E",
    tabIconSelected: "#1C1917",
    link: "#B45309",
    primary: "#1C1917",
    primaryDark: "#0C0A09",
    secondary: "#A8A29E",
    accent: "#D97706",
    backgroundRoot: "#FAF9F7",
    backgroundDefault: "#FAF9F7",
    backgroundSecondary: "#F4F1EC",
    backgroundTertiary: "#ECE8E1",
    surface: "#F4F1EC",
    card: "#FFFFFF",
    border: "#E5E0D8",
    borderLight: "#F0ECE5",
    success: "#15803D",
    warning: "#D97706",
    error: "#DC2626",
    overlay: "rgba(28, 25, 23, 0.4)",
    cardShadow: "rgba(28, 25, 23, 0.08)",
    primaryLight: "rgba(28, 25, 23, 0.06)",
    primarySubtle: "rgba(28, 25, 23, 0.14)",
    accentLight: "rgba(217, 119, 6, 0.1)",
    successLight: "rgba(21, 128, 61, 0.09)",
    warningLight: "rgba(217, 119, 6, 0.05)",
    warningSubtle: "rgba(217, 119, 6, 0.09)",
    warningBorder: "rgba(217, 119, 6, 0.15)",
    errorLight: "rgba(220, 38, 38, 0.09)",
    ripple: "rgba(28, 25, 23, 0.1)",
    rippleLight: "rgba(255, 255, 255, 0.3)",
    separator: "rgba(28, 25, 23, 0.06)",
    overlayLight: "rgba(255, 255, 255, 0.2)",
    overlayText: "rgba(255, 255, 255, 0.85)",
  },
  dark: {
    text: "#FAFAF9",
    textSecondary: "#A8A29E",
    buttonText: "#0C0A09",
    tabIconDefault: "#57534E",
    tabIconSelected: "#FAFAF9",
    link: "#FBBF24",
    primary: "#FAFAF9",
    primaryDark: "#E7E5E4",
    secondary: "#78716C",
    accent: "#F59E0B",
    backgroundRoot: "#0C0A09",
    backgroundDefault: "#0C0A09",
    backgroundSecondary: "#1A1815",
    backgroundTertiary: "#26231F",
    surface: "#26231F",
    card: "#1A1815",
    border: "#2E2A25",
    borderLight: "#26231F",
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
    overlay: "rgba(0, 0, 0, 0.6)",
    cardShadow: "rgba(0, 0, 0, 0.4)",
    primaryLight: "rgba(250, 250, 249, 0.07)",
    primarySubtle: "rgba(250, 250, 249, 0.16)",
    accentLight: "rgba(245, 158, 11, 0.12)",
    successLight: "rgba(74, 222, 128, 0.09)",
    warningLight: "rgba(251, 191, 36, 0.05)",
    warningSubtle: "rgba(251, 191, 36, 0.09)",
    warningBorder: "rgba(251, 191, 36, 0.15)",
    errorLight: "rgba(248, 113, 113, 0.09)",
    ripple: "rgba(255, 255, 255, 0.1)",
    rippleLight: "rgba(255, 255, 255, 0.3)",
    separator: "rgba(255, 255, 255, 0.06)",
    overlayLight: "rgba(255, 255, 255, 0.2)",
    overlayText: "rgba(255, 255, 255, 0.85)",
  },
};

export type ThemeColors = typeof Colors.light;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
} as const;

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
} as const;

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
    fontFamily: "Nunito_700Bold",
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
    fontFamily: "Nunito_700Bold",
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
    fontFamily: "Nunito_600SemiBold",
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700" as const,
    fontFamily: "Nunito_700Bold",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
    fontFamily: "Nunito_600SemiBold",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
    fontFamily: "Nunito_400Regular",
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    fontFamily: "Nunito_400Regular",
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    fontFamily: "Nunito_500Medium",
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    fontFamily: "Nunito_400Regular",
  },
} as const;

export const Fonts = {
  heading: "Righteous_400Regular",
  body: "Poppins_400Regular",
  bodyMedium: "Poppins_500Medium",
  bodySemiBold: "Poppins_600SemiBold",
  bodyBold: "Poppins_700Bold",
} as const;

export const ClayShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
  },
  android: { elevation: 12 },
  default: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
  },
})!;

export const ClayShadowSmall = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 4 },
  default: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
})!;

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
  })!,
  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
  })!,
  lg: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
  })!,
} as const;
