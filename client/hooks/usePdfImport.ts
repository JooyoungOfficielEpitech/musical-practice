import { useState, useCallback, useRef } from "react";
import { AccessibilityInfo } from "react-native";
import {
  pickPdf,
  readFileAsBase64,
  type PageRange,
} from "@/lib/pdfImport";

export type PdfImportState = "idle" | "picking" | "uploading" | "error";

export interface UsePdfImportReturn {
  state: PdfImportState;
  chunks: PageRange[];
  sectionTitles: string[];
  pdfB64: string | null;
  fileName: string | null;
  error: string | null;
  startImport(): Promise<void>;
  reset(): void;
}

function autoNameFromFile(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").trim();
}

export function usePdfImport(): UsePdfImportReturn {
  const [state, setState] = useState<PdfImportState>("idle");
  const [sectionTitles, setSectionTitles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pdfB64Ref = useRef<string | null>(null);
  const fileNameRef = useRef<string | null>(null);

  const startImport = useCallback(async () => {
    setState("picking");
    setError(null);
    try {
      const picked = await pickPdf();
      if (!picked) {
        setState("error");
        setError("No file selected");
        AccessibilityInfo.announceForAccessibility("File selection cancelled");
        return;
      }
      setState("uploading");
      const b64 = await readFileAsBase64(picked.uri);
      pdfB64Ref.current = b64;
      fileNameRef.current = picked.name;

      // Auto-name from the document's real name, not the UUID cache filename
      const autoTitle = autoNameFromFile(picked.name);
      setSectionTitles([autoTitle || "Score"]);
      // state stays "uploading" — PdfImportScreen auto-triggers submitAll via useEffect
      AccessibilityInfo.announceForAccessibility(
        `File ${picked.name} uploaded, preparing for music recognition`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[usePdfImport] startImport failed:", e);
      setState("error");
      setError(msg);
      AccessibilityInfo.announceForAccessibility(`Upload failed: ${msg}`);
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setSectionTitles([]);
    setError(null);
    pdfB64Ref.current = null;
    fileNameRef.current = null;
  }, []);

  return {
    state,
    chunks: [],
    sectionTitles,
    pdfB64: pdfB64Ref.current,
    fileName: fileNameRef.current,
    error,
    startImport,
    reset,
  };
}
