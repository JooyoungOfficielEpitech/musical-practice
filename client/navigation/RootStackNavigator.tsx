import React, { useState, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TabNavigator } from "@/navigation/TabNavigator";
import PracticeDetailScreen from "@/screens/PracticeDetailScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PdfImportScreen from "@/screens/PdfImportScreen";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import type { RootStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStackNavigator() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    hasCompletedOnboarding().then(setOnboardingDone);
  }, []);

  // Wait until we know if onboarding is complete
  if (onboardingDone === null) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingDone && (
        <Stack.Screen name="Onboarding">
          {() => <OnboardingScreen onComplete={() => setOnboardingDone(true)} />}
        </Stack.Screen>
      )}
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="PracticeDetail" component={PracticeDetailScreen} />
      <Stack.Screen name="PdfImport" component={PdfImportScreen} />
    </Stack.Navigator>
  );
}
