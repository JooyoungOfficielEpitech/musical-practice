import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { usePractice } from "@/context/PracticeContext";
import { useSynthPlayer } from "@/hooks/useSynthPlayer";
import { usePlaybackOptions, type PlaybackOptionsState } from "@/hooks/usePlaybackOptions";
import { parseMusicXml } from "@/lib/audio/musicXmlParser";
import { buildPlaybackNotes, mergeNoteEvents } from "@/lib/audio/playbackNotes";
import { buildBeatGrid, generateMetronomeEvents } from "@/lib/audio/beatGrid";
import { downloadResult } from "@/lib/omrQueue";
import { buildRetryPatch } from "@/lib/omrRetry";
import { dlog } from "@/lib/debug/debugLog";
import { countNotesByPart, resolveInitialVisibleParts } from "@/lib/audio/partSelection";
import { resolveExistingUri } from "@/lib/fileStorage";
import type { RenameData } from "@/components/RenameModal";
import type { NoteSequence, PartInfo } from "@/types/music";

export interface PracticeDetailState {
  showEdit: boolean; setShowEdit: (v: boolean) => void;
  showDeleteConfirm: boolean; setShowDeleteConfirm: (v: boolean) => void;
  musicXmlContent: string | null; musicXmlLoading: boolean; hasMusicXml: boolean;
  musicXmlLoadError: string | null;
  partsDeselectedError: string | null;
  partInfos: PartInfo[];
  partNoteCounts: Record<string, number>;
  visiblePartIds: Set<string>;
  togglePartVisibility: (partId: string) => void;
  noteSequence: NoteSequence;
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  playback: PlaybackOptionsState;
  omrRetrying: boolean;
  handleRetryOmr: () => Promise<void>;
  handleNotePress: (noteIndex: number) => void;
  handleSynthPlayPause: () => Promise<void>;
  handleDeletePress: () => void;
  handleDeleteConfirm: () => Promise<void>;
  handleEdit: (data: RenameData) => Promise<void>;
}

export function usePracticeDetail(sheetId: string): PracticeDetailState {
  const navigation = useNavigation();
  const { sheets, patchSheet, removeSheet, persistPartSelection } = usePractice();
  const sheet = useMemo(() => sheets.find((s) => s.id === sheetId), [sheets, sheetId]);

  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [musicXmlContent, setMusicXmlContent] = useState<string | null>(null);
  const [noteSequence, setNoteSequence] = useState<NoteSequence>([]);
  const [musicXmlLoading, setMusicXmlLoading] = useState(false);
  const [musicXmlLoadError, setMusicXmlLoadError] = useState<string | null>(null);
  const [partsDeselectedError, setPartsDeselectedError] = useState<string | null>(null);

  const [partInfos, setPartInfos] = useState<PartInfo[]>([]);
  const [partNoteCounts, setPartNoteCounts] = useState<Record<string, number>>({});
  const [visiblePartIds, setVisiblePartIds] = useState<Set<string>>(new Set());
  const notePartIndicesRef = useRef<number[]>([]);

  const playback = usePlaybackOptions(sheet, patchSheet);

  // Full playback pipeline: part filter → per-part volume → transpose.
  const playbackNotes = useMemo(
    () =>
      buildPlaybackNotes({
        notes: noteSequence,
        notePartIndices: notePartIndicesRef.current,
        partInfos,
        visiblePartIds,
        partVolumes: playback.partVolumes,
        transposeSemitones: playback.transpose,
      }),
    [noteSequence, visiblePartIds, partInfos, playback.partVolumes, playback.transpose],
  );

  // Metronome clicks ride the same shared bar grid as the notes.
  const beatGrid = useMemo(
    () => (musicXmlContent ? buildBeatGrid(musicXmlContent) : null),
    [musicXmlContent],
  );
  const notesForPlayer = useMemo(() => {
    if (!playback.metronomeOn || !beatGrid) return playbackNotes;
    return mergeNoteEvents(playbackNotes, generateMetronomeEvents(beatGrid));
  }, [playbackNotes, playback.metronomeOn, beatGrid]);

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
    notesForPlayer,
    sheet?.selectedInstrument ?? "piano",
    sheet?.savedTempoMultiplier ?? 1.0,
  );

  // Remember the user's tempo per score — reopening must not reset their choice.
  const persistedTempoRef = useRef(sheet?.savedTempoMultiplier ?? 1.0);
  useEffect(() => {
    if (!sheet || synthPlayer.tempo === persistedTempoRef.current) return;
    persistedTempoRef.current = synthPlayer.tempo;
    dlog("load", "persist tempo", { multiplier: synthPlayer.tempo });
    patchSheet(sheet.id, { savedTempoMultiplier: synthPlayer.tempo }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synthPlayer.tempo]);

  const hasMusicXml = !!sheet?.musicXmlUri;

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


  const handleNotePress = useCallback((idx: number) => {
    if (noteSequence[idx]) synthPlayer.seekTo(noteSequence[idx].startTime * 1000);
  }, [synthPlayer, noteSequence]);

  const handleSynthPlayPause = useCallback(async () => {
    if (synthPlayer.isPlaying) await synthPlayer.pause(); else await synthPlayer.play();
  }, [synthPlayer]);

  // Failed scan → clone the job server-side and flip back to "processing";
  // the library poll then tracks the new job like any fresh import.
  const [omrRetrying, setOmrRetrying] = useState(false);
  const handleRetryOmr = useCallback(async () => {
    if (!sheet || omrRetrying) return;
    setOmrRetrying(true);
    try {
      const patch = await buildRetryPatch(sheet);
      await patchSheet(sheet.id, patch);
    } finally {
      setOmrRetrying(false);
    }
  }, [sheet, omrRetrying, patchSheet]);

  const handleDeletePress = useCallback(() => { setShowDeleteConfirm(true); }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!sheet) return;
    setShowDeleteConfirm(false);
    await removeSheet(sheet.id);
    navigation.goBack();
  }, [sheet, removeSheet, navigation]);

  const handleEdit = useCallback(async (data: RenameData) => {
    if (!sheet) return;
    await patchSheet(sheet.id, data);
    setShowEdit(false);
  }, [sheet, patchSheet]);

  return {
    showEdit, setShowEdit,
    showDeleteConfirm, setShowDeleteConfirm,
    musicXmlContent, musicXmlLoading, hasMusicXml, musicXmlLoadError, partsDeselectedError,
    noteSequence,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
    synthPlayer,
    playback, omrRetrying, handleRetryOmr,
    handleNotePress, handleSynthPlayPause,
    handleDeletePress, handleDeleteConfirm, handleEdit,
  };
}
