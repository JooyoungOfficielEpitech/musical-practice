/**
 * osmdSource — bundled OpenSheetMusicDisplay for offline score rendering.
 *
 * The score WebView used to load OSMD from a CDN, so with no network the
 * score never rendered. The minified OSMD build ships as an app asset
 * (assets/osmd/*.jslib, see metro.config.js) and gets inlined into the
 * WebView HTML. Returns null when the asset can't be read — the caller
 * falls back to the CDN script tag.
 */
import { Asset } from "expo-asset";
import { File } from "expo-file-system";

let osmdJsPromise: Promise<string | null> | null = null;

export function getOsmdSource(): Promise<string | null> {
  if (!osmdJsPromise) {
    osmdJsPromise = (async () => {
      try {
        const asset = Asset.fromModule(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("../../assets/osmd/opensheetmusicdisplay.min.jslib"),
        );
        await asset.downloadAsync();
        if (!asset.localUri) return null;
        const js = await new File(asset.localUri).text();
        // A stray closing tag would terminate the inline <script> block early.
        return js.replace(/<\/script>/gi, "<\\/script>");
      } catch (e) {
        console.warn("[osmdSource] bundled OSMD unavailable — falling back to CDN:", e);
        osmdJsPromise = null; // allow a retry on the next call
        return null;
      }
    })();
  }
  return osmdJsPromise;
}
