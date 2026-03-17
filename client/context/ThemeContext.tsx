import React, { createContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { Colors, type ThemeColors } from "@/constants/theme";

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType>({
  colors: Colors.light,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
