import type { SheetMusic } from "./storage";
import { copyToLocalStorage, isDocumentUri, fileExists, rebaseDocumentUri } from "./fileStorage";
import { formatImportDate } from "./practiceCardUtils";

// Old imports derived titles from the picker's cache URI, whose filename is a
// UUID (dashes sometimes already replaced with spaces by auto-naming).
const UUID_TITLE_RE =
  /^[0-9a-f]{8}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{12}$/i;

/**
 * Migrate legacy SheetMusic data (imageUri: string) to new format (imageUris: string[]).
 * Handles both old and new data formats gracefully.
 */
export function migrateSheetMusic(data: any): SheetMusic {
  const { imageUri, imageUris, ...rest } = data;

  const migratedImageUris: string[] =
    Array.isArray(imageUris)
      ? imageUris
      : imageUri
        ? [imageUri]
        : [];

  const title =
    typeof rest.title === "string" && UUID_TITLE_RE.test(rest.title.trim())
      ? `Score ${formatImportDate(rest.createdAt ?? Date.now())}`
      : rest.title;

  return {
    ...rest,
    title,
    imageUris: migratedImageUris,
    audioUri: data.audioUri,
  };
}

/**
 * Migrate file URIs from cache to permanent document storage.
 * Also re-roots stale document URIs when the iOS container UUID changes after an update.
 * - Skips URIs already in document storage (after rebasing).
 * - Copies cache URIs to permanent storage if the file still exists.
 * - Removes URIs for files that no longer exist anywhere.
 */
export async function migrateFileUrisToDocument(
  sheets: SheetMusic[],
): Promise<SheetMusic[]> {
  const results: SheetMusic[] = [];

  for (const sheet of sheets) {
    let changed = false;

    // Migrate image URIs
    const migratedImages: string[] = [];
    for (const uri of sheet.imageUris) {
      if (isDocumentUri(uri)) {
        // Re-root to current container if UUID changed
        const rebased = rebaseDocumentUri(uri);
        migratedImages.push(rebased);
        if (rebased !== uri) changed = true;
      } else if (fileExists(uri)) {
        const copied = await copyToLocalStorage(uri, "images");
        if (copied) {
          migratedImages.push(copied);
          changed = true;
        }
      } else {
        // File no longer exists in cache — drop it
        changed = true;
      }
    }

    // Migrate audio URI
    let migratedAudio: string | undefined = sheet.audioUri;
    if (sheet.audioUri) {
      if (isDocumentUri(sheet.audioUri)) {
        const rebased = rebaseDocumentUri(sheet.audioUri);
        if (rebased !== sheet.audioUri) {
          migratedAudio = rebased;
          changed = true;
        }
      } else if (fileExists(sheet.audioUri)) {
        const copied = await copyToLocalStorage(sheet.audioUri, "audio");
        migratedAudio = copied ?? undefined;
        changed = true;
      } else {
        migratedAudio = undefined;
        changed = true;
      }
    }

    // Re-root OMR artifact URIs (musicXML, note sequence). These always live in
    // document storage, so they only ever need rebasing — never a cache copy.
    let migratedMusicXml = sheet.musicXmlUri;
    if (sheet.musicXmlUri && isDocumentUri(sheet.musicXmlUri)) {
      const rebased = rebaseDocumentUri(sheet.musicXmlUri);
      if (rebased !== sheet.musicXmlUri) { migratedMusicXml = rebased; changed = true; }
    }
    let migratedNoteSeq = sheet.noteSequenceUri;
    if (sheet.noteSequenceUri && isDocumentUri(sheet.noteSequenceUri)) {
      const rebased = rebaseDocumentUri(sheet.noteSequenceUri);
      if (rebased !== sheet.noteSequenceUri) { migratedNoteSeq = rebased; changed = true; }
    }

    if (changed) {
      results.push({
        ...sheet,
        imageUris: migratedImages,
        audioUri: migratedAudio,
        musicXmlUri: migratedMusicXml,
        noteSequenceUri: migratedNoteSeq,
      });
    } else {
      results.push(sheet);
    }
  }

  return results;
}
