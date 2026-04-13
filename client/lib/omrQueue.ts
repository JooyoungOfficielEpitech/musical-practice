/**
 * omrQueue — Supabase-backed OMR job queue operations.
 *
 * Pure library layer: no React, no hooks, no UI imports.
 * Throws OmrQueueError when Supabase is not configured or any operation fails.
 */
import { File, Directory, Paths } from "expo-file-system";
import { supabase } from "./supabase";
import type { PageRange } from "./pdfImport";

export class OmrQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OmrQueueError";
  }
}

const PDF_BUCKET = "omr-pdfs";
const RESULT_BUCKET = "omr-results";
const JOBS_TABLE = "omr_jobs";

function requireSupabase() {
  if (!supabase) {
    throw new OmrQueueError(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and " +
        "EXPO_PUBLIC_SUPABASE_ANON_KEY before using the OMR queue.",
    );
  }
  return supabase;
}

/**
 * Upload a base64-encoded PDF to Supabase Storage.
 *
 * @returns The storage path (e.g. "job-abc.pdf") within the omr-pdfs bucket.
 */
export async function uploadPdfToStorage(
  pdfB64: string,
  jobId: string,
): Promise<string> {
  const client = requireSupabase();
  const storagePath = `${jobId}.pdf`;
  const binary = atob(pdfB64);
  const pdfBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    pdfBytes[i] = binary.charCodeAt(i);
  }

  const { error } = await client.storage
    .from(PDF_BUCKET)
    .upload(storagePath, pdfBytes, { contentType: "application/pdf" });

  if (error) {
    throw new OmrQueueError(`Failed to upload PDF to storage: ${error.message}`);
  }

  return storagePath;
}

/**
 * Insert a new OMR job row with status 'pending'.
 *
 * @returns The UUID of the newly created job.
 */
export async function submitOmrJob(
  pdfStoragePath: string,
  pageRanges: PageRange[],
): Promise<string> {
  const client = requireSupabase();

  const { data, error } = await client
    .from(JOBS_TABLE)
    .insert({ pdf_storage_path: pdfStoragePath, page_ranges: pageRanges })
    .select()
    .single();

  if (error || !data) {
    throw new OmrQueueError(`Failed to submit OMR job: ${error?.message ?? "no data returned"}`);
  }

  return data.id as string;
}

/**
 * Download the MusicXML result from Supabase Storage and save it to local device storage.
 *
 * @returns The local file URI of the saved MusicXML.
 */
export async function downloadResult(
  resultStoragePath: string,
  sheetId: string,
): Promise<string> {
  const client = requireSupabase();

  const { data, error } = await client.storage
    .from(RESULT_BUCKET)
    .download(resultStoragePath);

  if (error || !data) {
    throw new OmrQueueError(`Failed to download result: ${error?.message ?? "no data"}`);
  }

  const xmlText = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read MusicXML blob"));
    reader.readAsText(data as Blob);
  });
  const dir = new Directory(Paths.document, "musicxml");
  if (!dir.exists) {
    dir.create();
  }
  const file = new File(Paths.document, `musicxml/${sheetId}.musicxml`);
  console.log(`[omrQueue] MusicXML size: ${xmlText.length} chars`);
  file.write(xmlText);

  return file.uri;
}
