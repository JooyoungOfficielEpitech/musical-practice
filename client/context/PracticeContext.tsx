import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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
  removeSheet: (id: string) => Promise<void>;
  persistPartSelection: (id: string, partIds: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

const PENDING_POLL_INTERVAL_MS = 5_000;

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<SheetMusic[]>([]);
  const [loading, setLoading] = useState(true);

  const patchSheet = useCallback(async (id: string, patch: Partial<SheetMusic>) => {
    const patched = await patchSheetStorage(id, patch);
    if (patched) {
      setSheets((prev) => prev.map((s) => (s.id === id ? patched : s)));
    }
  }, []);

  /** Sheets stuck in "processing" whose job finished while the app was away —
   *  check the server and flip them to ready/failed. Fire-and-forget. */
  const reconcilePendingSheets = useCallback(
    (loaded: SheetMusic[]) => {
      loaded
        .filter((s) => s.omrStatus === "processing" && s.omrJobId)
        .forEach((sheet) => {
          reconcileOmrSheet(sheet)
            .then((patch) => {
              if (patch) return patchSheet(sheet.id, patch);
            })
            .catch(() => {
              // Offline or transient — try again on the next refresh.
            });
        });
    },
    [patchSheet],
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
      reconcilePendingSheets(migratedSheets);
    } finally {
      setLoading(false);
    }
  }, [reconcilePendingSheets]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // While any sheet is still processing, poll its job row so the library card
  // flips to Ready without an app restart (covers relaunch mid-processing,
  // where no import-screen subscription is alive).
  useEffect(() => {
    const pending = sheets.filter((s) => s.omrStatus === "processing" && s.omrJobId);
    if (pending.length === 0) return;
    const id = setInterval(() => {
      pending.forEach((sheet) => {
        reconcileOmrSheet(sheet)
          .then((patch) => {
            if (patch) return patchSheet(sheet.id, patch);
          })
          .catch(() => {});
      });
    }, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [sheets, patchSheet]);

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

  return (
    <PracticeContext.Provider
      value={{
        sheets,
        loading,
        addSheet,
        editSheet,
        patchSheet,
        removeSheet,
        persistPartSelection,
        refreshData,
      }}
    >
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}
