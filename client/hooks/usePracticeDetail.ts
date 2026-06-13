import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Platform, AppState, LayoutAnimation } from "react-native";
import { setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { usePractice } from "@/context/PracticeContext";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useSynthPlayer } from "@/hooks/useSynthPlayer";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { usePitchAccuracy } from "@/hooks/usePitchAccuracy";
import { useAudioPermission } from "@/hooks/useAudioPermission";
import { useRecording } from "@/hooks/useRecording";
import { useOmr } from "@/hooks/useOmr";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { parseMusicXml } from "@/lib/audio/musicXmlParser";
import { countNotesByPart, resolveInitialVisibleParts } from "@/lib/audio/partSelection";
import { resolveExistingUri } from "@/lib/fileStorage";
import type { SheetFormData } from "@/lib/storage";
import type { NoteSequence, PartInfo } from "@/types/music";
import type { PitchResult } from "@/lib/audio/types";

export type AudioMode = "reference" | "autoplay";
export interface SessionResult { duration: number; accuracy: number; bpm: number; recordingSaved: boolean; }

export interface PracticeDetailState {
  currentBpm: number; setCurrentBpm: (v: number) => void;
  showMetronome: boolean;
  showEdit: boolean; setShowEdit: (v: boolean) => void;
  isPracticing: boolean;
  isStartingPractice: boolean;
  showDeleteConfirm: boolean; setShowDeleteConfirm: (v: boolean) => void;
  sessionResult: SessionResult | null; setSessionResult: (r: SessionResult | null) => void;
  audioMode: AudioMode; setAudioMode: (mode: AudioMode) => void;
  musicXmlContent: string | null; musicXmlLoading: boolean; hasMusicXml: boolean;
  showInstrumentPicker: boolean; setShowInstrumentPicker: (v: boolean) => void;
  editMode: boolean; setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  partInfos: PartInfo[];
  partNoteCounts: Record<string, number>;
  visiblePartIds: Set<string>;
  togglePartVisibility: (partId: string) => void;
  noteSequence: NoteSequence;
  sheetSessions: ReturnType<typeof usePractice>["sessions"];
  bestScore: number | null;
  sheetRecordings: ReturnType<typeof usePractice>["recordings"];
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  noteEditor: ReturnType<typeof useNoteEditor>;
  isListening: boolean; currentPitch: PitchResult | null; pitchError: string | null;
  sessionAccuracy: number; isRecording: boolean;
  omr: ReturnType<typeof useOmr>;
  handleNotePress: (noteIndex: number) => void;
  handleSynthPlayPause: () => Promise<void>;
  handleTimerStart: () => Promise<boolean>;
  handleSessionStop: (totalSeconds: number) => Promise<void>;
  handleRunningChange: (running: boolean) => void;
  handleScanSheet: () => Promise<void>;
  handleStartPractice: () => Promise<void>;
  handleDeletePress: () => void;
  handleDeleteConfirm: () => Promise<void>;
  toggleMetronome: () => void;
  handleEdit: (data: SheetFormData) => Promise<void>;
}

export function usePracticeDetail(sheetId: string): PracticeDetailState {
  const navigation = useNavigation();
  const { sheets, sessions, recordings, addSession, editSheet, removeSheet, refreshData, persistPartSelection } = usePractice();
  const sheet = useMemo(() => sheets.find((s) => s.id === sheetId), [sheets, sheetId]);

  const [currentBpm, setCurrentBpm] = useState(120);
  const [showMetronome, setShowMetronome] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [audioMode, setAudioMode] = useState<AudioMode>("reference");
  const [musicXmlContent, setMusicXmlContent] = useState<string | null>(null);
  const [noteSequence, setNoteSequence] = useState<NoteSequence>([]);
  const [musicXmlLoading, setMusicXmlLoading] = useState(false);
  const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);
  const [editMode, setEditMode] = useState(true);

  const [partInfos, setPartInfos] = useState<PartInfo[]>([]);
  const [partNoteCounts, setPartNoteCounts] = useState<Record<string, number>>({});
  const [visiblePartIds, setVisiblePartIds] = useState<Set<string>>(new Set());
  const notePartIndicesRef = useRef<number[]>([]);
  const filteredNotes = useMemo(() => {
    const indices = notePartIndicesRef.current;
    if (visiblePartIds.size === 0 || visiblePartIds.size === partInfos.length || indices.length === 0) {
      return noteSequence;
    }
    return noteSequence.filter((_, i) => {
      const idx = indices[i];
      return idx !== undefined && visiblePartIds.has(partInfos[idx]?.id);
    });
  }, [noteSequence, visiblePartIds, partInfos]);

  const togglePartVisibility = useCallback((partId: string) => {
    const next = new Set(visiblePartIds);
    if (next.has(partId)) { next.delete(partId); } else { next.add(partId); }
    // Never leave a score with zero audible parts.
    if (next.size === 0) return;
    setVisiblePartIds(next);
    if (sheet) persistPartSelection(sheet.id, [...next]).catch(() => {});
  }, [visiblePartIds, sheet, persistPartSelection]);

  const synthPlayer = useSynthPlayer(filteredNotes);
  const audioPlayer = useAudioPlayer();
  const noteEditor = useNoteEditor(musicXmlContent ?? "", noteSequence);
  const { isRecording, startRecording, stopRecording, addAudioData } = useRecording();
  const isRecordingRef = useRef(false);
  const omr = useOmr();
  const { isListening, currentPitch, error: pitchError, startListening, stopListening } = usePitchDetection({ onAudioData: addAudioData });
  const { sessionAccuracy, addReading, reset: resetAccuracy } = usePitchAccuracy();
  const { isGranted, requestPermission } = useAudioPermission();
  const hasMusicXml = !!sheet?.musicXmlUri;

  const sheetSessions = useMemo(() => sessions.filter((s) => s.sheetMusicId === sheetId), [sessions, sheetId]);
  const bestScore = useMemo(
    () => (sheetSessions.length > 0 ? Math.max(...sheetSessions.map((s) => s.accuracy)) : null),
    [sheetSessions],
  );
  const sheetRecordings = useMemo(() => {
    const ids = new Set(sheetSessions.map((s) => s.id));
    return recordings.filter((r) => ids.has(r.sessionId));
  }, [sheetSessions, recordings]);

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  useEffect(() => {
    if (!sheet?.musicXmlUri) { setMusicXmlContent(null); setNoteSequence([]); return; }
    let cancelled = false;
    setMusicXmlLoading(true);
    (async () => {
      try {
        const { File } = await import("expo-file-system");
        // Rebase in case the app container path changed after an update.
        const xml = await new File(resolveExistingUri(sheet.musicXmlUri!)).text();
        if (cancelled) return;
        setMusicXmlContent(xml);
        const parsed = parseMusicXml(xml);
        setNoteSequence(parsed.notes);
        setPartInfos(parsed.parts);
        setPartNoteCounts(countNotesByPart(parsed.notePartIndices, parsed.parts));
        notePartIndicesRef.current = parsed.notePartIndices;
        setVisiblePartIds(resolveInitialVisibleParts(parsed.parts, sheet.selectedPartIds));
      } catch { if (!cancelled) { setMusicXmlContent(null); setNoteSequence([]); } }
      finally { if (!cancelled) setMusicXmlLoading(false); }
    })();
    return () => { cancelled = true; };
    // Re-seed parts only when the score file changes, not on every selection edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.musicXmlUri]);


  useEffect(() => {
    if (sheet?.audioUri) audioPlayer.loadSound(resolveExistingUri(sheet.audioUri));
    return () => { audioPlayer.unload(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.audioUri]);

  useEffect(() => { if (currentPitch) addReading(currentPitch); }, [currentPitch, addReading]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPracticing && audioPlayer.isLoaded && audioPlayer.isPlaying) audioPlayer.pause();
    });
    return () => sub.remove();
  }, [isPracticing, audioPlayer]);

  const handleNotePress = useCallback((idx: number) => {
    if (noteSequence[idx]) synthPlayer.seekTo(noteSequence[idx].startTime * 1000);
  }, [synthPlayer, noteSequence]);

  const handleSynthPlayPause = useCallback(async () => {
    if (synthPlayer.isPlaying) await synthPlayer.pause(); else await synthPlayer.play();
  }, [synthPlayer]);

  const setupAudioSession = useCallback(async () => {
    if (Platform.OS !== "web") {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
    }
  }, []);

  const handleTimerStart = useCallback(async (): Promise<boolean> => {
    if (!isGranted && !(await requestPermission())) return false;
    resetAccuracy();
    try { await setupAudioSession(); } catch { /* non-fatal */ }
    startRecording();
    try { await startListening(); } catch {
      stopRecording("__aborted__").catch(() => {});
      return false;
    }
    if (sheet?.audioUri) {
      try { await audioPlayer.loadSound(resolveExistingUri(sheet.audioUri)); await audioPlayer.play(); } catch { /* non-fatal */ }
    }
    return true;
  }, [isGranted, requestPermission, resetAccuracy, setupAudioSession, startListening, startRecording, stopRecording, audioPlayer, sheet]);

  const handleSessionStop = useCallback(async (totalSeconds: number) => {
    if (!sheet) return;
    stopListening();
    if (audioPlayer.isLoaded) await audioPlayer.pause();
    if (Platform.OS !== "web") setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const accuracy = sessionAccuracy > 0 ? sessionAccuracy : 0;
    const wasRecording = isRecordingRef.current;
    const sessionId = await addSession({ sheetMusicId: sheet.id, sheetMusicTitle: sheet.title, startedAt: Date.now() - totalSeconds * 1000, duration: totalSeconds, accuracy, bpm: currentBpm });
    let recordingUri: string | undefined;
    if (wasRecording) { const uri = await stopRecording(sessionId); if (uri) recordingUri = uri; }
    resetAccuracy();
    if (recordingUri) await refreshData();
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSessionResult({ duration: totalSeconds, accuracy, bpm: currentBpm, recordingSaved: !!recordingUri });
  }, [sheet, addSession, currentBpm, sessionAccuracy, stopListening, resetAccuracy, stopRecording, refreshData, audioPlayer]);

  const handleRunningChange = useCallback((running: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPracticing(running);
  }, []);

  const handleScanSheet = useCallback(async () => {
    if (!sheet || sheet.imageUris.length === 0 || omr.isProcessing) return;
    const result = await omr.processImage(sheet.imageUris[0], sheet);
    if (result) await refreshData();
  }, [sheet, omr, refreshData]);

  const handleStartPractice = useCallback(async () => {
    setIsStartingPractice(true);
    const ok = await handleTimerStart();
    setIsStartingPractice(false);
    if (ok) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsPracticing(true); }
  }, [handleTimerStart]);

  const handleDeletePress = useCallback(() => { setShowDeleteConfirm(true); }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!sheet) return;
    setShowDeleteConfirm(false);
    await removeSheet(sheet.id);
    navigation.goBack();
  }, [sheet, removeSheet, navigation]);

  const toggleMetronome = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowMetronome((prev) => !prev);
  }, []);

  const handleEdit = useCallback(async (data: SheetFormData) => {
    if (!sheet) return;
    await editSheet({ ...sheet, ...data });
    setShowEdit(false);
  }, [sheet, editSheet]);

  return {
    currentBpm, setCurrentBpm, showMetronome, showEdit, setShowEdit,
    isPracticing, isStartingPractice, showDeleteConfirm, setShowDeleteConfirm,
    sessionResult, setSessionResult, audioMode, setAudioMode,
    musicXmlContent, musicXmlLoading, hasMusicXml, noteSequence,
    showInstrumentPicker, setShowInstrumentPicker, editMode, setEditMode,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
    sheetSessions, bestScore, sheetRecordings,
    synthPlayer, audioPlayer, noteEditor,
    isListening, currentPitch, pitchError: pitchError ?? null, sessionAccuracy, isRecording, omr,
    handleNotePress, handleSynthPlayPause, handleTimerStart, handleSessionStop,
    handleRunningChange, handleScanSheet, handleStartPractice,
    handleDeletePress, handleDeleteConfirm, toggleMetronome, handleEdit,
  };
}
