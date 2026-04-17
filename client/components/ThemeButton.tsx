import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface ThemeButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function ThemeButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
}: ThemeButtonProps): React.ReactElement {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    Animated.spring(scale, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const bgColor: string =
    variant === "danger"
      ? colors.error
      : variant === "secondary"
      ? `rgba(37,99,235,0.09)`
      : colors.primary;

  const textColor: string =
    variant === "secondary" ? colors.primary : colors.buttonText;

  const containerStyle: ViewStyle = {
    backgroundColor: bgColor,
    borderRadius: 50,
    opacity: disabled ? 0.5 : 1,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        testID="theme-button"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={containerStyle}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        {loading ? (
          <ActivityIndicator
            testID="theme-button-spinner"
            color={textColor}
            size="small"
          />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
