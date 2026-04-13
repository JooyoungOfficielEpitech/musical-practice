import { useState, useCallback } from "react";
import { processSheetMusicImage, getOmrStatus, type OmrStatus, type OmrResult } from "@/lib/omr";
import { updateSheet, getSheets } from "@/lib/storage";
import type { SheetMusic } from "@/lib/storage";

interface UseOmrReturn {
  processImage: (imageUri: string, sheet: SheetMusic) => Promise<OmrResult | null>;
  isProcessing: boolean;
  error: string | null;
  status: OmrStatus;
}

/**
 * Hook for OMR (Optical Music Recognition) processing.
 * Wraps the OMR service with React state management and
 * updates SheetMusic.omrStatus during processing.
 */
export function useOmr(): UseOmrReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OmrStatus>("none");

  const processImage = useCallback(
    async (imageUri: string, sheet: SheetMusic): Promise<OmrResult | null> => {
      setIsProcessing(true);
      setError(null);
      setStatus("processing");

      // Update sheet status to 'processing'
      await updateSheet({ ...sheet, omrStatus: "processing" });

      try {
        const result = await processSheetMusicImage(imageUri, sheet.id);

        // Update sheet with result URIs and status
        await updateSheet({
          ...sheet,
          musicXmlUri: result.musicXmlUri,
          noteSequenceUri: result.noteSequenceUri,
          omrStatus: "ready",
        });

        setStatus("ready");
        setIsProcessing(false);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "OMR processing failed";
        console.error("[useOmr] Processing failed:", message);

        // Update sheet status to 'failed'
        await updateSheet({ ...sheet, omrStatus: "failed" });

        setError(message);
        setStatus("failed");
        setIsProcessing(false);
        return null;
      }
    },
    [],
  );

  return { processImage, isProcessing, error, status };
}
