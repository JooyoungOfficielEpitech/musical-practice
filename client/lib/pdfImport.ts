import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";

export type PageRange = [number, number];

export interface PickedPdf {
  uri: string;
  /** Original document name (asset.name) — the cache URI filename is a UUID. */
  name: string;
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
  };
}

/**
 * Read a local file and return its content as a base64 string.
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  return file.base64();
}
