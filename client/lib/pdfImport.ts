import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";

export type PageRange = [number, number];

export interface PickedPdf {
  uri: string;
  /** Original document name (asset.name) — the cache URI filename is a UUID. */
  name: string;
  /** File size in bytes when the picker reports it. */
  size: number | null;
}

/**
 * Open the system document picker filtered to PDFs.
 * Returns the file URI plus the human-readable name, or null if the user cancels.
 */
export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || asset.uri.split("/").pop() || "Score",
    size: typeof asset.size === "number" ? asset.size : null,
  };
}

/**
 * Best-effort page count from raw PDF bytes: counts "/Type /Page" objects.
 * Modern PDFs may pack page objects into compressed object streams — those
 * yield no matches and return null, and callers simply hide the count.
 */
export function estimatePdfPageCount(pdfB64: string): number | null {
  try {
    const raw =
      typeof atob === "function"
        ? atob(pdfB64)
        : Buffer.from(pdfB64, "base64").toString("binary");
    const matches = raw.match(/\/Type\s*\/Page(?!s)/g);
    return matches && matches.length > 0 ? matches.length : null;
  } catch {
    return null;
  }
}

/**
 * Read a local file and return its content as a base64 string.
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  return file.base64();
}
