import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Fonts, ClayShadow, Spacing, BorderRadius } from "@/constants/theme";

interface SuccessViewProps {
  onViewLibrary: () => void;
}

export function SuccessView({ onViewLibrary }: SuccessViewProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.center, { backgroundColor: colors.backgroundDefault }]}
      edges={["top", "bottom"]}
    >
      <Text style={[styles.successText, { color: colors.text }]}>
        All sections ready!
      </Text>
      <Text
        style={[
          styles.successSubtext,
          { color: colors.textSecondary },
        ]}
      >
        Your scores are now in the Library
      </Text>
      <Pressable
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        onPress={onViewLibrary}
        accessibilityLabel="View library with imported scores"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
          View Library
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

interface ErrorViewProps {
  errorMsg: string;
  isUploadError: boolean;
  onRetry: () => void;
  onCancel: () => void;
}

export function ErrorView({
  errorMsg,
  isUploadError,
  onRetry,
  onCancel,
}: ErrorViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const errorContextMsg = isUploadError
    ? "Please try uploading again"
    : "Some sections failed. You can retry them individually below, or try the entire process again.";

  return (
    <SafeAreaView
      style={[styles.center, { backgroundColor: colors.backgroundDefault }]}
      edges={["top", "bottom"]}
    >
      <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
      <Text
        style={[
          styles.errorContextText,
          { color: colors.textSecondary },
        ]}
      >
        {errorContextMsg}
      </Text>
      <Pressable
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        onPress={onRetry}
        accessibilityLabel={isUploadError ? "Retry upload" : "Try again"}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
          {isUploadError ? "Retry Upload" : "Try Again"}
        </Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={onCancel}
        accessibilityLabel="Cancel and go back"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
          Cancel
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

interface IdleViewProps {
  onGoBack: () => void;
}

export function IdleView({ onGoBack }: IdleViewProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.center, { backgroundColor: colors.backgroundDefault }]}
      edges={["top", "bottom"]}
    >
      <LoadingOverlay message="Opening file picker…" />
      <View style={styles.backButtonContainer}>
        <Pressable
          onPress={onGoBack}
          accessibilityLabel="Go back to library"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  successText: { fontSize: 22, fontFamily: Fonts.heading, fontWeight: "700", marginBottom: 8 },
  successSubtext: { fontSize: 14, marginBottom: 32, textAlign: "center" },
  errorText: { fontSize: 16, fontFamily: Fonts.body, marginBottom: 12, textAlign: "center" },
  errorContextText: { fontSize: 14, marginBottom: 24, textAlign: "center" },
  primaryButton: {
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: 24,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    ...ClayShadow,
  },
  primaryButtonText: { fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  secondaryButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 15, fontFamily: Fonts.body },
  backButtonContainer: { position: "absolute", bottom: Spacing.lg, left: Spacing.lg },
  backButtonText: { fontSize: 15, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
});
