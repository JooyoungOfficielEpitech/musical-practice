import { useState, useCallback, useRef } from "react";
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
      const uri = await pickPdf();
      if (!uri) {
        setState("error");
        setError("No file selected");
        return;
      }
      setState("uploading");
      const b64 = await readFileAsBase64(uri);
      pdfB64Ref.current = b64;

      // Extract filename from URI (last path component)
      const fileName = uri.split("/").pop() || "Score";
      fileNameRef.current = fileName;

      // Auto-name from filename
      const autoTitle = autoNameFromFile(fileName);
      setSectionTitles([autoTitle]);
      // state stays "uploading" — PdfImportScreen auto-triggers submitAll via useEffect
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[usePdfImport] startImport failed:", e);
      setState("error");
      setError(msg);
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
