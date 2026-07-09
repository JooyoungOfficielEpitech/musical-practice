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

/**
 * Return the current user, bootstrapping a silent anonymous session when
 * none exists. The app has no account UX — uploads are scoped per-device
 * via Supabase anonymous auth so storage RLS (auth.uid() path prefix) holds.
 */
async function ensureUser(client: NonNullable<typeof supabase>) {
  const { data: { user } } = await client.auth.getUser();
  if (user) return user;

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    throw new OmrQueueError(
      "Could not start a session for upload. Please check your connection and try again." +
        (error ? ` (${error.message})` : ""),
    );
  }
  return data.user;
}

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
 * Path is prefixed with the authenticated user's ID to satisfy storage RLS.
 *
 * @returns The storage path (e.g. "{userId}/job-abc.pdf") within the omr-pdfs bucket.
 */
export async function uploadPdfToStorage(
  pdfB64: string,
  jobId: string,
): Promise<string> {
  const client = requireSupabase();

  const user = await ensureUser(client);

  const storagePath = `${user.id}/${jobId}.pdf`;
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

  const user = await ensureUser(client);

  const { data, error } = await client
    .from(JOBS_TABLE)
    .insert({ pdf_storage_path: pdfStoragePath, page_ranges: pageRanges, user_id: user.id })
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

/** Storage path of the page-1 thumbnail the worker uploads beside the result. */
export function previewStoragePath(resultStoragePath: string): string {
  return resultStoragePath.replace(/\.musicxml$/, "") + ".preview.jpg";
}

/**
 * Download the page-1 preview JPEG for a result and save it to local storage.
 *
 * @returns The local file URI, or null when no preview exists (legacy results
 *          processed before previews shipped) or Supabase is unavailable.
 */
export async function downloadPreview(
  resultStoragePath: string,
  sheetId: string,
): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(RESULT_BUCKET)
    .download(previewStoragePath(resultStoragePath));

  if (error || !data) return null;

  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read preview blob"));
    reader.readAsDataURL(data as Blob);
  });

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const dir = new Directory(Paths.document, "images");
  if (!dir.exists) {
    dir.create();
  }
  const file = new File(Paths.document, `images/${sheetId}-preview.jpg`);
  file.write(bytes);

  return file.uri;
}
