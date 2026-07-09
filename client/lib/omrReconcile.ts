/**
 * omrReconcile — catch up sheets whose OMR job finished while the app was away.
 *
 * A sheet is persisted the moment its job is queued (omrStatus "processing",
 * omrJobId set). If the user leaves the import screen or kills the app, no
 * subscription is alive to flip it to "ready" — this module re-checks the job
 * row on demand (library refresh) and returns the patch to apply.
 */
import { supabase } from "@/lib/supabase";
import { downloadResult } from "@/lib/omrQueue";
import type { SheetMusic } from "@/lib/storage";

type JobRow = {
  status: string;
  result_storage_path: string | null;
  error: string | null;
};

/**
 * Check the omr_jobs row backing a still-processing sheet.
 * Returns a patch for the sheet, or null when nothing changed (still running,
 * offline, or the job row is gone).
 */
export async function reconcileOmrSheet(
  sheet: SheetMusic,
): Promise<Partial<SheetMusic> | null> {
  if (!supabase || !sheet.omrJobId || sheet.omrStatus !== "processing") {
    return null;
  }

  const { data, error } = await supabase
    .from("omr_jobs")
    .select("status, result_storage_path, error")
    .eq("id", sheet.omrJobId)
    .single();

  if (error || !data) return null;
  const row = data as JobRow;

  if (row.status === "done" && row.result_storage_path) {
    const musicXmlUri = await downloadResult(row.result_storage_path, sheet.id);
    return {
      musicXmlUri,
      resultStoragePath: row.result_storage_path,
      omrStatus: "ready",
    };
  }

  if (row.status === "failed") {
    return { omrStatus: "failed" };
  }

  return null;
}
