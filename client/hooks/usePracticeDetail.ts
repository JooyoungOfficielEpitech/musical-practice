import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { usePractice } from "@/context/PracticeContext";
import { useSynthPlayer } from "@/hooks/useSynthPlayer";
import { usePlaybackOptions, type PlaybackOptionsState } from "@/hooks/usePlaybackOptions";
import { usePlaybackNotes } from "@/hooks/usePlaybackNotes";
import { useLoopControls, type LoopControlsState } from "@/hooks/useLoopControls";
import { usePracticeExtras, type PracticeExtrasState } from "@/hooks/usePracticeExtras";
import { parseMusicXml, parseTempo } from "@/lib/audio/musicXmlParser";
import { originalToScaledMs } from "@/lib/audio/transportMath";
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
  /** Sanitized score BPM — the WebView cursor must use the SAME tempo as audio. */
  scoreBpm: number | null;
  musicXmlLoadError: string | null;
  partsDeselectedError: string | null;
  partInfos: PartInfo[];
  partNoteCounts: Record<string, number>;
  visiblePartIds: Set<string>;
  togglePartVisibility: (partId: string) => void;
  noteSequence: NoteSequence;
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  playback: PlaybackOptionsState;
  loop: LoopControlsState;
  soloPart: (partId: string) => void;
  extras: PracticeExtrasState;
  omrRetrying: boolean;
  handleRetryOmr: () => Promise<void>;
  handleNotePress: (noteIndex: number, timeMs?: number | null) => void;
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

  const scoreBpm = useMemo(
    () => (musicXmlContent ? parseTempo(musicXmlContent) : null),
    [musicXmlContent],
  );

  const playback = usePlaybackOptions(sheet, patchSheet);
  const notesForPlayer = usePlaybackNotes({
    noteSequence, notePartIndicesRef, partInfos, visiblePartIds, playback, musicXmlContent,
  });

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
        if (sheet.resultStoragePath && !sheet.hasLocalEdits) {
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


  const loop = useLoopControls(synthPlayer);

  // A note edit re-parses in place — same pipeline as the initial load.
  const applyEditedXml = useCallback((xml: string) => {
    setMusicXmlContent(xml);
    const parsed = parseMusicXml(xml);
    setNoteSequence(parsed.notes);
    setPartInfos(parsed.parts);
    setPartNoteCounts(countNotesByPart(parsed.notePartIndices, parsed.parts));
    notePartIndicesRef.current = parsed.notePartIndices;
  }, []);

  const extras = usePracticeExtras({
    sheet, patchSheet, noteSequence, notePartIndicesRef, partInfos,
    visiblePartIds, playback, synthPlayer, musicXmlContent,
    onXmlEdited: applyEditedXml,
  });

  const soloPart = useCallback((partId: string) => {
    const isSolo = visiblePartIds.size === 1 && visiblePartIds.has(partId);
    const next = isSolo ? new Set(partInfos.map((p) => p.id)) : new Set([partId]);
    setPartsDeselectedError(null);
    setVisiblePartIds(next);
    if (sheet) persistPartSelection(sheet.id, [...next]).catch(() => {});
  }, [visiblePartIds, partInfos, sheet, persistPartSelection]);

  const handleNotePress = useCallback((idx: number, timeMs: number | null = null) => {
    // Edit mode swallows taps to select notes for fixing.
    if (extras.editor.handleEditTap(timeMs)) return;
    // Prefer the WebView's grid time (exact) over the step index (ambiguous).
    const originalMs = timeMs ?? (noteSequence[idx] ? noteSequence[idx].startTime * 1000 : null);
    if (originalMs === null) return;
    // While the loop is armed, taps define the A–B points instead of seeking.
    if (loop.handleScoreTap(originalMs / 1000)) return;
    // seekTo lives on the tempo-scaled timeline; note times are original-score.
    synthPlayer.seekTo(originalToScaledMs(originalMs, synthPlayer.tempo));
  }, [synthPlayer, noteSequence, loop, extras.editor]);

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
    musicXmlContent, musicXmlLoading, hasMusicXml, scoreBpm, musicXmlLoadError, partsDeselectedError,
    noteSequence,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
    synthPlayer,
    playback, loop, soloPart, extras, omrRetrying, handleRetryOmr,
    handleNotePress, handleSynthPlayPause,
    handleDeletePress, handleDeleteConfirm, handleEdit,
  };
}
