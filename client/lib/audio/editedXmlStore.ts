import { File } from "expo-file-system";
import { resolveExistingUri } from "@/lib/fileStorage";

/**
 * Store edited MusicXML to the sheet's file location.
 * Integrator should guard: skip server refresh when sheet.hasLocalEdits is true.
 *
 * @param sheetId the sheet's ID (used for logging/context)
 * @param musicXmlUri the sheet's musicXmlUri (must be resolvable by resolveExistingUri)
 * @param xml the edited MusicXML content
 * @throws if file I/O fails
 */
export async function saveEditedXml(
  sheetId: string,
  musicXmlUri: string,
  xml: string,
): Promise<void> {
  try {
    const uri = resolveExistingUri(musicXmlUri);
    const file = new File(uri);
    await file.write(xml);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(
      `Failed to save edited XML for sheet ${sheetId}: ${msg}`,
    );
  }
}
