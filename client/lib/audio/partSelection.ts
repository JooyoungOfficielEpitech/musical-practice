import type { PartInfo } from "@/types/music";

/**
 * Count how many notes belong to each part, keyed by part id.
 *
 * @param notePartIndices notePartIndices[i] = partIndex of the i-th note.
 * @param parts The parts detected in the score.
 */
export function countNotesByPart(
  notePartIndices: number[],
  parts: PartInfo[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const part of parts) counts[part.id] = 0;
  for (const idx of notePartIndices) {
    const part = parts[idx];
    if (part) counts[part.id] += 1;
  }
  return counts;
}

/**
 * Resolve which parts should be visible when a score is first opened.
 *
 * Restores a previously persisted selection, but only the ids that still exist
 * in the current score (a re-OMR may have changed the parts). If nothing
 * persisted is still valid, every part is shown.
 */
export function resolveInitialVisibleParts(
  parts: PartInfo[],
  selectedPartIds?: string[],
): Set<string> {
  const allIds = parts.map((p) => p.id);
  if (selectedPartIds && selectedPartIds.length > 0) {
    const valid = selectedPartIds.filter((id) => allIds.includes(id));
    if (valid.length > 0) return new Set(valid);
  }
  return new Set(allIds);
}
