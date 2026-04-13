import { useState, useCallback, useRef } from "react";
import {
  pickPdf,
  readFileAsBase64,
  fetchPdfChunks,
  defaultTitles,
  type PdfChunk,
  type PageRange,
} from "@/lib/pdfImport";

export type PdfImportState =
  | "idle"
  | "picking"
  | "uploading"
  | "selecting"
  | "naming"
  | "error";

export interface UsePdfImportReturn {
  state: PdfImportState;
  chunks: PdfChunk[];
  pageRanges: PageRange[];
  sectionTitles: string[];
  pdfB64: string | null;
  error: string | null;
  startImport(): Promise<void>;
  setPageRanges(ranges: PageRange[]): void;
  setSectionTitle(index: number, title: string): void;
  proceedToNaming(): void;
  reset(): void;
}

export function usePdfImport(): UsePdfImportReturn {
  const [state, setState] = useState<PdfImportState>("idle");
  const [chunks, setChunks] = useState<PdfChunk[]>([]);
  const [pageRanges, setPageRangesState] = useState<PageRange[]>([]);
  const [sectionTitles, setSectionTitlesState] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pdfB64Ref = useRef<string | null>(null);
  const pageRangesRef = useRef<PageRange[]>([]);

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
      const result = await fetchPdfChunks(b64, []);
      setChunks(result.chunks);
      setState("selecting");
    } catch (e) {
      console.error("[usePdfImport] startImport failed:", e);
      setState("error");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  const setPageRanges = useCallback((ranges: PageRange[]) => {
    pageRangesRef.current = ranges;
    setPageRangesState(ranges);
  }, []);

  const setSectionTitle = useCallback((index: number, title: string) => {
    setSectionTitlesState((prev) =>
      prev.map((t, i) => (i === index ? title : t)),
    );
  }, []);

  const proceedToNaming = useCallback(() => {
    const count = pageRangesRef.current.length || 1;
    setSectionTitlesState(defaultTitles(count, "Score"));
    setState("naming");
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setChunks([]);
    setPageRangesState([]);
    setSectionTitlesState([]);
    setError(null);
    pdfB64Ref.current = null;
  }, []);

  return {
    state,
    chunks,
    pageRanges,
    sectionTitles,
    pdfB64: pdfB64Ref.current,
    error,
    startImport,
    setPageRanges,
    setSectionTitle,
    proceedToNaming,
    reset,
  };
}
