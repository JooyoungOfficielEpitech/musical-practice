import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  type SheetMusic,
  getSheets,
  saveSheet,
  updateSheet,
  patchSheet as patchSheetStorage,
  deleteSheet as deleteSheetStorage,
  generateId,
} from "@/lib/storage";
import { copyImagesToStorage, copyToLocalStorage, isDocumentUri } from "@/lib/fileStorage";
import { migrateFileUrisToDocument } from "@/lib/migration";
import { reconcileOmrSheet } from "@/lib/omrReconcile";
import { downloadPreview } from "@/lib/omrQueue";

interface PracticeContextType {
  sheets: SheetMusic[];
  loading: boolean;
  addSheet: (sheet: Omit<SheetMusic, "id" | "createdAt" | "isFavorite">) => Promise<SheetMusic>;
  editSheet: (sheet: SheetMusic) => Promise<void>;
  patchSheet: (id: string, patch: Partial<SheetMusic>) => Promise<void>;
  /** In-memory-only patch for ephemeral fields (live progress) — no storage write. */
  patchSheetLocal: (id: string, patch: Partial<SheetMusic>) => void;
  removeSheet: (id: string) => Promise<void>;
  persistPartSelection: (id: string, partIds: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

const PENDING_POLL_INTERVAL_MS = 5_000;

/** Progress-only patches are ephemeral — not worth an AsyncStorage write. */
function isEphemeralPatch(patch: Partial<SheetMusic>): boolean {
  const keys = Object.keys(patch);
  return keys.length === 1 && keys[0] === "omrProgress";
}

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<SheetMusic[]>([]);
  const [loading, setLoading] = useState(true);
  // Latest sheets for long-lived timers — keeps the poll interval stable
  // instead of tearing it down on every state change.
  const sheetsRef = useRef<SheetMusic[]>(sheets);
  useEffect(() => {
    sheetsRef.current = sheets;
  }, [sheets]);

  const patchSheetLocal = useCallback((id: string, patch: Partial<SheetMusic>) => {
    setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const patchSheet = useCallback(
    async (id: string, patch: Partial<SheetMusic>) => {
      const patched = await patchSheetStorage(id, patch);
      if (patched) {
        // Apply the patch onto the CURRENT state object (not the storage copy)
        // so in-memory-only fields like omrProgress survive.
        patchSheetLocal(id, patch);
      }
    },
    [patchSheetLocal],
  );

  const applyReconcilePatch = useCallback(
    (id: string, patch: Partial<SheetMusic>) => {
      if (isEphemeralPatch(patch)) {
        patchSheetLocal(id, patch);
        return Promise.resolve();
      }
      return patchSheet(id, patch);
    },
    [patchSheet, patchSheetLocal],
  );

  // Guard against overlapping reconciles for one sheet (slow network + 5s tick).
  const reconcileInFlightRef = useRef<Set<string>>(new Set());

  const reconcileSheet = useCallback(
    (sheet: SheetMusic) => {
      if (reconcileInFlightRef.current.has(sheet.id)) return;
      reconcileInFlightRef.current.add(sheet.id);
      reconcileOmrSheet(sheet)
        .then((patch) => {
          if (patch) return applyReconcilePatch(sheet.id, patch);
        })
        .catch(() => {
          // Offline or transient — next tick retries.
        })
        .finally(() => {
          reconcileInFlightRef.current.delete(sheet.id);
        });
    },
    [applyReconcilePatch],
  );

  const refreshData = useCallback(async () => {
    try {
      const sheetsData = await getSheets();

      // Migrate any cache URIs to permanent document storage
      const migratedSheets = await migrateFileUrisToDocument(sheetsData);
      const sheetsChanged = migratedSheets.some(
        (s, i) =>
          s.imageUris !== sheetsData[i].imageUris ||
          s.audioUri !== sheetsData[i].audioUri ||
          s.musicXmlUri !== sheetsData[i].musicXmlUri ||
          s.noteSequenceUri !== sheetsData[i].noteSequenceUri,
      );
      if (sheetsChanged) {
        for (const sheet of migratedSheets) {
          await updateSheet(sheet);
        }
      }

      setSheets(migratedSheets);
      // Catch up sheets whose job finished while the app was away.
      migratedSheets
        .filter((s) => s.omrStatus === "processing" && s.omrJobId)
        .forEach(reconcileSheet);
    } finally {
      setLoading(false);
    }
  }, [reconcileSheet]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // While any sheet is still processing, poll its job row so the library card
  // shows live progress and flips to Ready without an app restart. The
  // interval is keyed on a boolean, so per-tick state updates never tear it
  // down — pending sheets are read from the ref each tick.
  const hasPending = sheets.some((s) => s.omrStatus === "processing" && s.omrJobId);
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      sheetsRef.current
        .filter((s) => s.omrStatus === "processing" && s.omrJobId)
        .forEach(reconcileSheet);
    }, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasPending, reconcileSheet]);

  // Ready sheets without a thumbnail: fetch the page-1 preview the worker
  // uploads beside the result. Once per sheet per session — a miss (legacy
  // result with no preview yet) retries on the next app launch.
  const previewAttemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    sheets
      .filter(
        (s) =>
          s.omrStatus === "ready" &&
          s.resultStoragePath &&
          s.imageUris.length === 0 &&
          !previewAttemptedRef.current.has(s.id),
      )
      .forEach((sheet) => {
        previewAttemptedRef.current.add(sheet.id);
        downloadPreview(sheet.resultStoragePath!, sheet.id)
          .then((uri) => {
            if (uri) return patchSheet(sheet.id, { imageUris: [uri] });
          })
          .catch(() => {
            // Offline — allow a retry within this session.
            previewAttemptedRef.current.delete(sheet.id);
          });
      });
  }, [sheets, patchSheet]);

  const addSheet = useCallback(
    async (data: Omit<SheetMusic, "id" | "createdAt" | "isFavorite">) => {
      // Copy files from cache to permanent storage
      const permanentImageUris = await copyImagesToStorage(data.imageUris);
      const permanentAudioUri = data.audioUri
        ? await copyToLocalStorage(data.audioUri, "audio")
        : undefined;

      const sheet: SheetMusic = {
        ...data,
        imageUris: permanentImageUris,
        audioUri: permanentAudioUri ?? undefined,
        id: generateId(),
        createdAt: Date.now(),
        isFavorite: false,
      };
      await saveSheet(sheet);
      setSheets((prev) => [sheet, ...prev]);
      return sheet;
    },
    [],
  );

  const editSheet = useCallback(async (sheet: SheetMusic) => {
    // Copy any new cache URIs to permanent storage (existing document URIs are skipped)
    const permanentImageUris = await copyImagesToStorage(sheet.imageUris);
    const permanentAudioUri = sheet.audioUri
      ? isDocumentUri(sheet.audioUri)
        ? sheet.audioUri
        : await copyToLocalStorage(sheet.audioUri, "audio")
      : undefined;

    const updated: SheetMusic = {
      ...sheet,
      imageUris: permanentImageUris,
      audioUri: permanentAudioUri ?? undefined,
    };
    await updateSheet(updated);
    setSheets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const removeSheet = useCallback(async (id: string) => {
    await deleteSheetStorage(id);
    setSheets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const persistPartSelection = useCallback(
    async (id: string, partIds: string[]) => {
      await patchSheet(id, { selectedPartIds: partIds });
    },
    [patchSheet],
  );

  const value = useMemo(
    () => ({
      sheets,
      loading,
      addSheet,
      editSheet,
      patchSheet,
      patchSheetLocal,
      removeSheet,
      persistPartSelection,
      refreshData,
    }),
    [
      sheets,
      loading,
      addSheet,
      editSheet,
      patchSheet,
      patchSheetLocal,
      removeSheet,
      persistPartSelection,
      refreshData,
    ],
  );

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}
