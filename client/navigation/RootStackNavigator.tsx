import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LibraryScreen from "@/screens/LibraryScreen";
import PracticeDetailScreen from "@/screens/PracticeDetailScreen";
import PdfImportScreen from "@/screens/PdfImportScreen";
import type { RootStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="PracticeDetail" component={PracticeDetailScreen} />
      <Stack.Screen name="PdfImport" component={PdfImportScreen} />
    </Stack.Navigator>
  );
}
