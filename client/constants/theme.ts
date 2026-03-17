import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#333333",
    textSecondary: "#888888",
    buttonText: "#FFFFFF",
    tabIconDefault: "#888888",
    tabIconSelected: "#FF69B4",
    link: "#FF69B4",
    primary: "#FF69B4",
    primaryDark: "#E0559E",
    secondary: "#E8A0BF",
    accent: "#9B59B6",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#FFF5F8",
    backgroundTertiary: "#FFE8F0",
    surface: "#FFF5F8",
    card: "#FFFFFF",
    border: "#FFD6E8",
    borderLight: "#FFE8F0",
    success: "#6BA368",
    warning: "#FFA94D",
    error: "#FF6B6B",
    overlay: "rgba(0, 0, 0, 0.4)",
    cardShadow: "rgba(0, 0, 0, 0.08)",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#AAAAAA",
    buttonText: "#FFFFFF",
    tabIconDefault: "#AAAAAA",
    tabIconSelected: "#FF85C0",
    link: "#FF85C0",
    primary: "#FF85C0",
    primaryDark: "#E06BA8",
    secondary: "#B794C7",
    accent: "#C084FC",
    backgroundRoot: "#0D0D15",
    backgroundDefault: "#0D0D15",
    backgroundSecondary: "#1A1A2E",
    backgroundTertiary: "#252542",
    surface: "#252542",
    card: "#1A1A2E",
    border: "#2D2D4A",
    borderLight: "#2D2D4A",
    success: "#7BB378",
    warning: "#FFB366",
    error: "#FF7B7B",
    overlay: "rgba(0, 0, 0, 0.6)",
    cardShadow: "rgba(0, 0, 0, 0.3)",
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
