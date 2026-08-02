/**
 * omrRetry — re-submit a failed OMR job without re-uploading the PDF.
 *
 * The original job row already stores the uploaded PDF's storage path and the
 * page ranges, so a retry is just a fresh job row cloned from the old one. The
 * existing library poll (omrReconcile) then tracks the new job to completion.
 */
import { supabase } from "./supabase";
import type { SheetMusic } from "./storage";

export class OmrRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OmrRetryError";
  }
}

const JOBS_TABLE = "omr_jobs";

function requireSupabase() {
  if (!supabase) {
    throw new OmrRetryError("Supabase is not configured — cannot retry the scan.");
  }
  return supabase;
}

/**
 * Clone the pdf path + page ranges of an old job into a new job row.
 * Returns the new job's id.
 */
export async function resubmitOmrJob(oldJobId: string): Promise<string> {
  const client = requireSupabase();

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    throw new OmrRetryError("No session — check your connection and try again.");
  }

  const { data: oldJob, error: selectError } = await client
    .from(JOBS_TABLE)
    .select("pdf_storage_path, page_ranges")
    .eq("id", oldJobId)
    .single();

  if (selectError || !oldJob) {
    throw new OmrRetryError(
      `Could not read the original scan job: ${selectError?.message ?? "not found"}`,
    );
  }

  const { data: newJob, error: insertError } = await client
    .from(JOBS_TABLE)
    .insert({
      pdf_storage_path: oldJob.pdf_storage_path,
      page_ranges: oldJob.page_ranges,
      user_id: user.id,
    })
    .select()
    .single();

  if (insertError || !newJob) {
    throw new OmrRetryError(
      `Could not restart the scan: ${insertError?.message ?? "no data returned"}`,
    );
  }

  return newJob.id as string;
}

/**
 * Re-submit the sheet's failed job and return the sheet patch that flips it
 * back to "processing" under the new job id.
 */
export async function buildRetryPatch(sheet: SheetMusic): Promise<Partial<SheetMusic>> {
  if (!sheet.omrJobId) {
    throw new OmrRetryError("This score has no scan job to retry — re-import the PDF.");
  }
  const newJobId = await resubmitOmrJob(sheet.omrJobId);
  return { omrJobId: newJobId, omrStatus: "processing", omrProgress: 0 };
}
