import React from "react";
import { Text, type TextProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Typography } from "@/constants/theme";

interface ThemedTextProps extends TextProps {
  variant?: keyof typeof Typography;
}

export function ThemedText({ variant, style, ...props }: ThemedTextProps) {
  const { colors } = useTheme();
  const typographyStyle = variant ? Typography[variant] : undefined;

  return (
    <Text
      style={[{ color: colors.text }, typographyStyle, style]}
      {...props}
    />
  );
}
