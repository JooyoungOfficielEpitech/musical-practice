import { File, Directory, Paths } from "expo-file-system";

/** Resolve Paths.document URI string (cached for performance) */
function getDocumentDirUri(): string {
  return Paths.document.uri;
}

/**
 * Check if a URI points to the app's permanent document storage.
 * Handles stale container UUIDs by checking for /Documents/ path segment.
 */
export function isDocumentUri(uri: string): boolean {
  if (!uri) return false;
  // Primary check: starts with current document directory
  if (uri.startsWith(getDocumentDirUri())) return true;
  // Fallback: URI contains /Documents/ segment (stale UUID from prior install)
  return /\/Documents\//.test(uri);
}

/**
 * Re-root a URI that points to a stale app container (UUID changed after update).
 * On iOS, app updates can change the container UUID while preserving file contents.
 * e.g. file:///.../<OLD-UUID>/Documents/images/file.jpg
 *   -> file:///.../<NEW-UUID>/Documents/images/file.jpg
 */
export function rebaseDocumentUri(uri: string): string {
  if (!uri) return uri;
  const currentDocUri = getDocumentDirUri();
  // Already using current container path
  if (uri.startsWith(currentDocUri)) return uri;
  // Extract relative path after /Documents/
  const marker = "/Documents/";
  const idx = uri.indexOf(marker);
  if (idx === -1) return uri;
  const relativePath = uri.substring(idx + marker.length);
  // Re-root to current document directory
  const base = currentDocUri.endsWith("/") ? currentDocUri : currentDocUri + "/";
  return base + relativePath;
}

/**
 * Check if a file exists at the given URI.
 * Tries the URI as-is first, then rebased to current container.
 */
export function fileExists(uri: string): boolean {
  if (!uri) return false;
  try {
    const file = new File(uri);
    if (file.exists) return true;
  } catch {
    // fall through to rebased check
  }
  // Try rebased URI (handles stale container UUID)
  const rebased = rebaseDocumentUri(uri);
  if (rebased !== uri) {
    try {
      const file = new File(rebased);
      return !!file.exists;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Resolve a persisted file URI to one that actually exists right now.
 *
 * Stored URIs are absolute paths under the iOS app container; an app update can
 * change the container path prefix, leaving the original stale. Returns the
 * original when its file exists, otherwise the URI rebased onto the current
 * container (best effort — the file content survives the container change).
 * Apply this at every READ site before handing a stored URI to a player or File.
 */
export function resolveExistingUri(uri: string): string {
  if (!uri) return uri;
  try {
    if (new File(uri).exists) return uri;
  } catch {
    // fall through to rebased candidate
  }
  return rebaseDocumentUri(uri);
}

/**
 * Copy a file to the app's permanent local storage.
 * Returns the new URI, or null on failure.
 */
export async function copyToLocalStorage(
  sourceUri: string,
  prefix: string,
): Promise<string | null> {
  if (!sourceUri) return null;

  try {
    const ext = sourceUri.includes(".") ? sourceUri.substring(sourceUri.lastIndexOf(".")) : "";
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;

    // Ensure target directory exists
    const targetDir = new Directory(Paths.document, prefix);
    if (!targetDir.exists) {
      targetDir.create();
    }

    const sourceFile = new File(sourceUri);
    const destFile = new File(targetDir, filename);
    sourceFile.copy(destFile);

    return destFile.uri;
  } catch {
    return null;
  }
}

/**
 * Copy an array of image URIs to permanent storage.
 * Skips URIs already in document storage. Returns only successful copies.
 */
export async function copyImagesToStorage(uris: string[]): Promise<string[]> {
  if (uris.length === 0) return [];

  const results: string[] = [];
  for (const uri of uris) {
    if (isDocumentUri(uri)) {
      // Rebase in case container UUID changed
      results.push(rebaseDocumentUri(uri));
      continue;
    }
    const copied = await copyToLocalStorage(uri, "images");
    if (copied) {
      results.push(copied);
    }
  }
  return results;
}

/**
 * Delete a local file. Returns true on success, false on failure.
 */
export async function deleteLocalFile(uri: string): Promise<boolean> {
  if (!uri) return false;

  try {
    const file = new File(uri);
    file.delete();
    return true;
  } catch {
    return false;
  }
}
