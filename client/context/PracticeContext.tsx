import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
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

interface PracticeContextType {
  sheets: SheetMusic[];
  sessions: PracticeSession[];
  stats: UserStats;
  loading: boolean;
  addSheet: (sheet: Omit<SheetMusic, "id" | "createdAt" | "isFavorite">) => Promise<SheetMusic>;
  editSheet: (sheet: SheetMusic) => Promise<void>;
  removeSheet: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  addSession: (session: Omit<PracticeSession, "id">) => Promise<void>;
  refreshData: () => Promise<void>;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<SheetMusic[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalPracticeTime: 0,
    totalSessions: 0,
    averageAccuracy: 0,
    streak: 0,
    lastPracticeDate: "",
  });
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [sheetsData, sessionsData, statsData] = await Promise.all([
      getSheets(),
      getSessions(),
      getStats(),
    ]);
    setSheets(sheetsData);
    setSessions(sessionsData);
    setStats(statsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addSheet = useCallback(
    async (data: Omit<SheetMusic, "id" | "createdAt" | "isFavorite">) => {
      const sheet: SheetMusic = {
        ...data,
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
    await updateSheet(sheet);
    setSheets((prev) => prev.map((s) => (s.id === sheet.id ? sheet : s)));
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
    async (data: Omit<PracticeSession, "id">) => {
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
    },
    [],
  );

  return (
    <PracticeContext.Provider
      value={{
        sheets,
        sessions,
        stats,
        loading,
        addSheet,
        editSheet,
        removeSheet,
        toggleFavorite,
        addSession,
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
