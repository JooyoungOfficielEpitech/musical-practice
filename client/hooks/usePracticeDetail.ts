import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Platform, AppState, LayoutAnimation } from "react-native";
import { setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { usePractice } from "@/context/PracticeContext";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useSynthPlayer } from "@/hooks/useSynthPlayer";
import { useOmr } from "@/hooks/useOmr";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { parseMusicXml } from "@/lib/audio/musicXmlParser";
import { downloadResult } from "@/lib/omrQueue";
import { dlog } from "@/lib/debug/debugLog";
import { countNotesByPart, resolveInitialVisibleParts } from "@/lib/audio/partSelection";
import { resolveExistingUri } from "@/lib/fileStorage";
import type { SheetFormData } from "@/lib/storage";
import type { NoteSequence, PartInfo } from "@/types/music";

export type AudioMode = "reference";

export interface PracticeDetailState {
  currentBpm: number; setCurrentBpm: (v: number) => void;
  showEdit: boolean; setShowEdit: (v: boolean) => void;
  showDeleteConfirm: boolean; setShowDeleteConfirm: (v: boolean) => void;
  audioMode: AudioMode; setAudioMode: (mode: AudioMode) => void;
  musicXmlContent: string | null; musicXmlLoading: boolean; hasMusicXml: boolean;
  musicXmlLoadError: string | null;
  audioLoadError: string | null;
  partsDeselectedError: string | null;
  showInstrumentPicker: boolean; setShowInstrumentPicker: (v: boolean) => void;
  editMode: boolean; setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  partInfos: PartInfo[];
  partNoteCounts: Record<string, number>;
  visiblePartIds: Set<string>;
  togglePartVisibility: (partId: string) => void;
  noteSequence: NoteSequence;
  sheetSessions: ReturnType<typeof usePractice>["sessions"];
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  noteEditor: ReturnType<typeof useNoteEditor>;
  omr: ReturnType<typeof useOmr>;
  handleNotePress: (noteIndex: number) => void;
  handleSynthPlayPause: () => Promise<void>;
  handleScanSheet: () => Promise<void>;
  handleDeletePress: () => void;
  handleDeleteConfirm: () => Promise<void>;
  handleEdit: (data: SheetFormData) => Promise<void>;
}

export function usePracticeDetail(sheetId: string): PracticeDetailState {
  const navigation = useNavigation();
  const { sheets, sessions, addSession, editSheet, removeSheet, refreshData, persistPartSelection } = usePractice();
  const sheet = useMemo(() => sheets.find((s) => s.id === sheetId), [sheets, sheetId]);

  const [currentBpm, setCurrentBpm] = useState(120);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("reference");
  const [musicXmlContent, setMusicXmlContent] = useState<string | null>(null);
  const [noteSequence, setNoteSequence] = useState<NoteSequence>([]);
  const [musicXmlLoading, setMusicXmlLoading] = useState(false);
  const [musicXmlLoadError, setMusicXmlLoadError] = useState<string | null>(null);
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null);
  const [partsDeselectedError, setPartsDeselectedError] = useState<string | null>(null);
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
    if (next.size === 0) {
      setPartsDeselectedError("At least one part must be selected");
      return;
    }
    setPartsDeselectedError(null);
    setVisiblePartIds(next);
    if (sheet) persistPartSelection(sheet.id, [...next]).catch(() => {});
  }, [visiblePartIds, sheet, persistPartSelection]);

  const synthPlayer = useSynthPlayer(
    filteredNotes,
    sheet?.selectedInstrument ?? "piano",
    sheet?.savedTempoMultiplier ?? 1.0,
  );
  const audioPlayer = useAudioPlayer();

  // Remember the user's tempo per score — reopening must not reset their choice.
  const persistedTempoRef = useRef(sheet?.savedTempoMultiplier ?? 1.0);
  useEffect(() => {
    if (!sheet || synthPlayer.tempo === persistedTempoRef.current) return;
    persistedTempoRef.current = synthPlayer.tempo;
    dlog("load", "persist tempo", { multiplier: synthPlayer.tempo });
    editSheet({ ...sheet, savedTempoMultiplier: synthPlayer.tempo }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synthPlayer.tempo]);
  const noteEditor = useNoteEditor(musicXmlContent ?? "", noteSequence);
  const omr = useOmr();
  const hasMusicXml = !!sheet?.musicXmlUri;

  const sheetSessions = useMemo(() => sessions.filter((s) => s.sheetMusicId === sheetId), [sessions, sheetId]);

  useEffect(() => {
    if (!sheet?.musicXmlUri) { setMusicXmlContent(null); setNoteSequence([]); setMusicXmlLoadError(null); return; }
    let cancelled = false;
    setMusicXmlLoading(true);
    setMusicXmlLoadError(null);
    (async () => {
      try {
        // Pull the latest server-side result first — scores get reprocessed on
        // the server, and the local file is otherwise a forever-stale snapshot.
        // Offline/failure falls back silently to the cached copy below.
        if (sheet.resultStoragePath) {
          try {
            await downloadResult(sheet.resultStoragePath, sheet.id);
            dlog("load", "server refresh OK", { path: sheet.resultStoragePath });
          } catch (refreshErr) {
            dlog("load", "server refresh FAILED — using cache", {
              msg: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
            });
          }
        } else {
          dlog("load", "no resultStoragePath — cache only (legacy sheet)");
        }
        const { File } = await import("expo-file-system");
        // Rebase in case the app container path changed after an update.
        const xml = await new File(resolveExistingUri(sheet.musicXmlUri!)).text();
        if (cancelled) return;
        setMusicXmlContent(xml);
        const parsed = parseMusicXml(xml);
        {
          // Cross-part drift detector: with the bar grid enforced, every part
          // must end at (nearly) the same time. A big spread = server-side bug.
          const ends = new Map<number, number>();
          parsed.notes.forEach((n, i) => {
            const p = parsed.notePartIndices[i];
            ends.set(p, Math.max(ends.get(p) ?? 0, n.startTime + n.duration));
          });
          const vals = [...ends.values()];
          const spread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
          dlog("load", "xml parsed", {
            chars: xml.length,
            parts: parsed.parts.length,
            notes: parsed.notes.length,
            partEndSpreadSec: spread,
          });
          if (spread > 2) dlog("load", "WARNING: cross-part end spread > 2s — parts likely misaligned");
        }
        setNoteSequence(parsed.notes);
        setPartInfos(parsed.parts);
        setPartNoteCounts(countNotesByPart(parsed.notePartIndices, parsed.parts));
        notePartIndicesRef.current = parsed.notePartIndices;
        setVisiblePartIds(resolveInitialVisibleParts(parsed.parts, sheet.selectedPartIds));
        setMusicXmlLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setMusicXmlContent(null);
          setNoteSequence([]);
          const msg = e instanceof Error ? e.message : "Failed to load music notation";
          dlog("load", "XML LOAD ERROR", { msg });
          setMusicXmlLoadError(msg);
        }
      }
      finally { if (!cancelled) setMusicXmlLoading(false); }
    })();
    return () => { cancelled = true; };
    // Re-seed parts only when the score file changes, not on every selection edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.musicXmlUri]);


  useEffect(() => {
    setAudioLoadError(null);
    if (sheet?.audioUri) {
      audioPlayer.loadSound(resolveExistingUri(sheet.audioUri)).catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load reference audio";
        setAudioLoadError(msg);
      });
    }
    return () => { audioPlayer.unload(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.audioUri]);


  const handleNotePress = useCallback((idx: number) => {
    if (noteSequence[idx]) synthPlayer.seekTo(noteSequence[idx].startTime * 1000);
  }, [synthPlayer, noteSequence]);

  const handleSynthPlayPause = useCallback(async () => {
    if (synthPlayer.isPlaying) await synthPlayer.pause(); else await synthPlayer.play();
  }, [synthPlayer]);

  const setupAudioSession = useCallback(async () => {
    if (Platform.OS !== "web") {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
    }
  }, []);


  const handleScanSheet = useCallback(async () => {
    if (!sheet || sheet.imageUris.length === 0 || omr.isProcessing) return;
    const result = await omr.processImage(sheet.imageUris[0], sheet);
    if (result) await refreshData();
  }, [sheet, omr, refreshData]);

  const handleDeletePress = useCallback(() => { setShowDeleteConfirm(true); }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!sheet) return;
    setShowDeleteConfirm(false);
    await removeSheet(sheet.id);
    navigation.goBack();
  }, [sheet, removeSheet, navigation]);

  const handleEdit = useCallback(async (data: SheetFormData) => {
    if (!sheet) return;
    await editSheet({ ...sheet, ...data });
    setShowEdit(false);
  }, [sheet, editSheet]);

  return {
    currentBpm, setCurrentBpm, showEdit, setShowEdit,
    showDeleteConfirm, setShowDeleteConfirm,
    audioMode, setAudioMode,
    musicXmlContent, musicXmlLoading, hasMusicXml, musicXmlLoadError, audioLoadError, partsDeselectedError,
    noteSequence,
    showInstrumentPicker, setShowInstrumentPicker, editMode, setEditMode,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
    sheetSessions,
    synthPlayer, audioPlayer, noteEditor,
    omr,
    handleNotePress, handleSynthPlayPause, handleScanSheet,
    handleDeletePress, handleDeleteConfirm, handleEdit,
  };
}
