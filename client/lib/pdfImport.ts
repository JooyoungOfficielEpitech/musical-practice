import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";

// Same server as omr.ts
const OMR_API_URL = "http://192.168.0.10:8000";

export type PageRange = [number, number];

export interface PdfChunk {
  pageRange: PageRange;
  pngB64s: string[];
}

export interface PdfChunksResult {
  chunks: PdfChunk[];
}

/**
 * Open the system document picker filtered to PDFs.
 * Returns the file URI or null if the user cancels.
 */
export async function pickPdf(): Promise<string | null> {
  const result = await getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Read a local file and return its content as a base64 string.
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  return file.base64();
}

/**
 * POST the PDF base64 to the OMR server and return chunks.
 *
 * pageRanges = [] means the server returns all pages as individual chunks.
 */
export async function fetchPdfChunks(
  pdfB64: string,
  pageRanges: PageRange[],
): Promise<PdfChunksResult> {
  const response = await fetch(`${OMR_API_URL}/pdf-chunks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf_b64: pdfB64, page_ranges: pageRanges }),
  });

  if (!response.ok) {
    throw new Error(`PDF chunks server error: ${response.status}`);
  }

  const data = await response.json() as { chunks: string[][] };

  const chunks: PdfChunk[] = data.chunks.map((pngB64s, index) => {
    const pageRange: PageRange =
      pageRanges.length > 0
        ? pageRanges[index]
        : [index + 1, index + 1];

    return { pageRange, pngB64s };
  });

  return { chunks };
}

/**
 * Generate default section titles for N sections of a PDF.
 * e.g. defaultTitles(3, "Les Mis") → ["Les Mis — Section 1", ...]
 */
export function defaultTitles(count: number, baseName: string): string[] {
  return Array.from({ length: count }, (_, i) => `${baseName} — Section ${i + 1}`);
}
