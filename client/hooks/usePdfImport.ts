import { useState, useCallback, useRef } from "react";
import { AccessibilityInfo } from "react-native";
import {
  pickPdf,
  readFileAsBase64,
  estimatePdfPageCount,
  type PageRange,
} from "@/lib/pdfImport";

export type PdfImportState = "idle" | "picking" | "confirm" | "uploading" | "error";

export interface UsePdfImportReturn {
  state: PdfImportState;
  chunks: PageRange[];
  sectionTitles: string[];
  pdfB64: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  pageCount: number | null;
  /** Prefilled score title derived from the document name — editable pre-scan. */
  defaultTitle: string;
  error: string | null;
  startImport(): Promise<void>;
  /** Confirm the picked file and hand off to upload with the chosen title. */
  confirmImport(title: string): void;
  reset(): void;
}

function autoNameFromFile(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").trim();
}

/**
 * Pick → confirm → upload state machine. Cancelling the system picker returns
 * to "idle" (the landing screen stays put); a picked file lands on "confirm"
 * where the user can name the score and see size/page info before scanning.
 */
export function usePdfImport(): UsePdfImportReturn {
  const [state, setState] = useState<PdfImportState>("idle");
  const [sectionTitles, setSectionTitles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [defaultTitle, setDefaultTitle] = useState("");
  const pdfB64Ref = useRef<string | null>(null);
  const fileNameRef = useRef<string | null>(null);

  const startImport = useCallback(async () => {
    setState("picking");
    setError(null);
    try {
      const picked = await pickPdf();
      if (!picked) {
        // Cancelling the picker is not an error — stay on the landing screen.
        setState("idle");
        AccessibilityInfo.announceForAccessibility("File selection cancelled");
        return;
      }
      const b64 = await readFileAsBase64(picked.uri);
      pdfB64Ref.current = b64;
      fileNameRef.current = picked.name;
      setFileSizeBytes(picked.size);
      setPageCount(estimatePdfPageCount(b64));
      // Auto-name from the document's real name, not the UUID cache filename
      setDefaultTitle(autoNameFromFile(picked.name) || "Score");
      setState("confirm");
      AccessibilityInfo.announceForAccessibility(
        `File ${picked.name} ready. Confirm the title to start scanning.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[usePdfImport] startImport failed:", e);
      setState("error");
      setError(msg);
      AccessibilityInfo.announceForAccessibility(`Import failed: ${msg}`);
    }
  }, []);

  const confirmImport = useCallback((title: string) => {
    if (!pdfB64Ref.current) return;
    setSectionTitles([title.trim() || fileNameRef.current?.replace(/\.pdf$/i, "") || "Score"]);
    setState("uploading");
    AccessibilityInfo.announceForAccessibility("Uploading, preparing for music recognition");
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setSectionTitles([]);
    setError(null);
    setPageCount(null);
    setFileSizeBytes(null);
    setDefaultTitle("");
    pdfB64Ref.current = null;
    fileNameRef.current = null;
  }, []);

  return {
    state,
    chunks: [],
    sectionTitles,
    pdfB64: pdfB64Ref.current,
    fileName: fileNameRef.current,
    fileSizeBytes,
    pageCount,
    defaultTitle,
    error,
    startImport,
    confirmImport,
    reset,
  };
}
