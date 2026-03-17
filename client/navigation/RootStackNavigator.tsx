import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TabNavigator } from "@/navigation/TabNavigator";
import PracticeDetailScreen from "@/screens/PracticeDetailScreen";
import type { RootStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="PracticeDetail" component={PracticeDetailScreen} />
    </Stack.Navigator>
  );
}
