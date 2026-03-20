import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type SheetMusic,
  type PracticeSession,
  type UserStats,
  getSheets,
  saveSheet,
  updateSheet,
  deleteSheet as deleteSheetStorage,
  getSessions,
  saveSession,
  getStats,
  updateStats,
  generateId,
} from "@/lib/storage";
import { copyImagesToStorage, copyToLocalStorage, isDocumentUri } from "@/lib/fileStorage";
import { migrateFileUrisToDocument } from "@/lib/migration";
import {
  getRecordings,
  deleteRecording as deleteRecordingStorage,
  renameRecording as renameRecordingStorage,
  getRecordingsBySessionId,
} from "@/lib/recordingStorage";
import type { Recording } from "@/lib/audio/types";

interface PracticeContextType {
  sheets: SheetMusic[];
  sessions: PracticeSession[];
  recordings: Recording[];
  stats: UserStats;
  loading: boolean;
  addSheet: (sheet: Omit<SheetMusic, "id" | "createdAt" | "isFavorite">) => Promise<SheetMusic>;
  editSheet: (sheet: SheetMusic) => Promise<void>;
  removeSheet: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  addSession: (session: Omit<PracticeSession, "id">) => Promise<string>;
  removeRecording: (id: string) => Promise<void>;
  renameRecording: (id: string, newTitle: string) => Promise<void>;
  refreshData: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<SheetMusic[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalPracticeTime: 0,
    totalSessions: 0,
    averageAccuracy: 0,
    streak: 0,
    lastPracticeDate: "",
  });
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [sheetsData, sessionsData, statsData, recordingsData] = await Promise.all([
      getSheets(),
      getSessions(),
      getStats(),
      getRecordings(),
    ]);

    // Migrate any cache URIs to permanent document storage
    const migratedSheets = await migrateFileUrisToDocument(sheetsData);
    const sheetsChanged = migratedSheets.some(
      (s, i) =>
        s.imageUris !== sheetsData[i].imageUris ||
        s.audioUri !== sheetsData[i].audioUri,
    );
    if (sheetsChanged) {
      for (const sheet of migratedSheets) {
        await updateSheet(sheet);
      }
    }

    setSheets(migratedSheets);
    setSessions(sessionsData);
    setStats(statsData);
    setRecordings(recordingsData);
    setLoading(false);
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

  const toggleFavorite = useCallback(
    async (id: string) => {
      const sheet = sheets.find((s) => s.id === id);
      if (sheet) {
        const updated = { ...sheet, isFavorite: !sheet.isFavorite };
        await updateSheet(updated);
        setSheets((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
    },
    [sheets],
  );

  const addSession = useCallback(
    async (data: Omit<PracticeSession, "id">): Promise<string> => {
      const session: PracticeSession = { ...data, id: generateId() };
      await saveSession(session);
      setSessions((prev) => [session, ...prev]);

      setStats((prevStats) => {
        const today = new Date().toDateString();
        const newStats: UserStats = {
          totalPracticeTime: prevStats.totalPracticeTime + data.duration,
          totalSessions: prevStats.totalSessions + 1,
          averageAccuracy:
            prevStats.totalSessions === 0
              ? data.accuracy
              : Math.round(
                  (prevStats.averageAccuracy * prevStats.totalSessions + data.accuracy) /
                    (prevStats.totalSessions + 1),
                ),
          streak:
            prevStats.lastPracticeDate === today
              ? prevStats.streak
              : prevStats.lastPracticeDate ===
                  new Date(Date.now() - 86400000).toDateString()
                ? prevStats.streak + 1
                : 1,
          lastPracticeDate: today,
        };
        updateStats(newStats);
        return newStats;
      });

      return session.id;
    },
    [],
  );

  const removeRecording = useCallback(async (id: string) => {
    await deleteRecordingStorage(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const renameRecording = useCallback(async (id: string, newTitle: string) => {
    await renameRecordingStorage(id, newTitle);
    setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, title: newTitle } : r)));
  }, []);

  const clearAllData = useCallback(async () => {
    // Delete all recording files
    for (const rec of recordings) {
      await deleteRecordingStorage(rec.id);
    }
    await AsyncStorage.multiRemove([
      "@musicalpractice/sheets",
      "@musicalpractice/sessions",
      "@musicalpractice/stats",
      "@musicalpractice/recordings",
    ]);
    setSheets([]);
    setSessions([]);
    setRecordings([]);
    setStats({
      totalPracticeTime: 0,
      totalSessions: 0,
      averageAccuracy: 0,
      streak: 0,
      lastPracticeDate: "",
    });
  }, []);

  return (
    <PracticeContext.Provider
      value={{
        sheets,
        sessions,
        recordings,
        stats,
        loading,
        addSheet,
        editSheet,
        removeSheet,
        toggleFavorite,
        addSession,
        removeRecording,
        renameRecording,
        refreshData,
        clearAllData,
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
