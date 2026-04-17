import React from "react";
import {
  StyleSheet, View, Text, Pressable,
  Platform, UIManager, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { PracticeActiveView } from "@/components/PracticeActiveView";
import { PracticeBrowseView } from "@/components/PracticeBrowseView";
import { PracticeBottomBar } from "@/components/PracticeBottomBar";
import { SheetFormModal } from "@/components/SheetFormModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SessionCompleteModal } from "@/components/SessionCompleteModal";
import { InstrumentPicker } from "@/components/InstrumentPicker";
import { PitchPicker } from "@/components/PitchPicker";
import { usePractice } from "@/context/PracticeContext";
import { usePracticeDetail } from "@/hooks/usePracticeDetail";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/types/navigation";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PracticeDetailRouteProp = RouteProp<RootStackParamList, "PracticeDetail">;

export default function PracticeDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const route = useRoute<PracticeDetailRouteProp>();
  const { width: screenWidth } = useWindowDimensions();
  const { sheetId } = route.params;
  const navigation = useNavigation();
  const { sheets, removeRecording, renameRecording, refreshData, loading } = usePractice();
  const sheet = sheets.find((s) => s.id === sheetId);
  const state = usePracticeDetail(sheetId);
  const {
    isPracticing, showEdit, setShowEdit, showDeleteConfirm, setShowDeleteConfirm,
    sessionResult, setSessionResult, showInstrumentPicker, setShowInstrumentPicker,
    editMode, synthPlayer, noteEditor, handleNotePress, handleSessionStop, handleRunningChange,
    handleDeleteConfirm, handleEdit, audioMode, musicXmlContent,
    isListening, currentPitch, pitchError, sessionAccuracy, isRecording, currentBpm, setCurrentBpm,
  } = state;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!sheet) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Score not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      {isPracticing && musicXmlContent ? (
        <PracticeActiveView
          title={sheet.title}
          musicXml={musicXmlContent}
          synthPlayer={synthPlayer}
          noteEditor={noteEditor}
          isListening={isListening}
          currentPitch={currentPitch}
          currentBpm={currentBpm}
          audioUrl={sheet.audioUri}
          onGoBack={() => navigation.goBack()}
        />
      ) : (
        <PracticeBrowseView
          sheet={sheet}
          state={state}
          screenWidth={screenWidth}
          loading={loading}
          onRefresh={refreshData}
          onGoBack={() => navigation.goBack()}
          removeRecording={removeRecording}
          renameRecording={renameRecording}
        />
      )}

      {isPracticing && (
        <PracticeBottomBar
          onStop={handleSessionStop}
          onRunningChange={handleRunningChange}
          minimal
          autoStart
        />
      )}

      <SheetFormModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={handleEdit}
        initialData={sheet}
      />

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Score"
        message={`Remove "${sheet.title}" from library?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        icon="trash-outline"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <SessionCompleteModal
        visible={!!sessionResult}
        result={sessionResult}
        onClose={() => setSessionResult(null)}
      />

      <InstrumentPicker
        visible={showInstrumentPicker}
        selectedInstrumentId={synthPlayer.instrument}
        onSelect={(id) => synthPlayer.setInstrument(id)}
        onClose={() => setShowInstrumentPicker(false)}
      />
      <PitchPicker
        visible={editMode && noteEditor.selectedIndex !== null}
        initialPitch={noteEditor.selectedPitch}
        onConfirm={noteEditor.applyPitch}
        onDismiss={noteEditor.dismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  notFoundText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
});
