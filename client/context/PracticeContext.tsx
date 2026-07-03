import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type SheetMusic,
  getSheets,
  saveSheet,
  updateSheet,
  deleteSheet as deleteSheetStorage,
  generateId,
} from "@/lib/storage";
import { copyImagesToStorage, copyToLocalStorage, isDocumentUri } from "@/lib/fileStorage";
import { migrateFileUrisToDocument } from "@/lib/migration";
import { processSheetMusicImage } from "@/lib/omr";

interface PracticeContextType {
  sheets: SheetMusic[];
  loading: boolean;
  addSheet: (sheet: Omit<SheetMusic, "id" | "createdAt" | "isFavorite">) => Promise<SheetMusic>;
  editSheet: (sheet: SheetMusic) => Promise<void>;
  removeSheet: (id: string) => Promise<void>;
  persistPartSelection: (id: string, partIds: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<SheetMusic[]>([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

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

      // Trigger OMR processing in background if sheet has images
      if (sheet.imageUris.length > 0 && !sheet.musicXmlUri) {
        processSheetMusicImage(sheet.imageUris[0], sheet.id)
          .then(async (result) => {
            const updated: SheetMusic = {
              ...sheet,
              musicXmlUri: result.musicXmlUri,
              noteSequenceUri: result.noteSequenceUri,
              omrStatus: "ready",
            };
            await updateSheet(updated);
            setSheets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          })
          .catch(async () => {
            const failed: SheetMusic = { ...sheet, omrStatus: "failed" };
            await updateSheet(failed);
            setSheets((prev) => prev.map((s) => (s.id === failed.id ? failed : s)));
          });
      }

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
      const sheet = sheets.find((s) => s.id === id);
      if (!sheet) return;
      const updated = { ...sheet, selectedPartIds: partIds };
      await updateSheet(updated);
      setSheets((prev) => prev.map((s) => (s.id === id ? updated : s)));
    },
    [sheets],
  );

  return (
    <PracticeContext.Provider
      value={{
        sheets,
        loading,
        addSheet,
        editSheet,
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
