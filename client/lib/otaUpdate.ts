/**
 * OTA auto-apply — fetch and load a pending EAS Update on launch.
 *
 * Default expo-updates behavior (fallbackToCacheTimeout: 0) launches the
 * cached bundle and only applies a downloaded update on the NEXT cold start,
 * so users need two restarts to see a fix. This checks right after launch
 * and reloads once the update is ready — one restart is enough.
 */
import * as Updates from "expo-updates";

export async function applyPendingUpdate(): Promise<void> {
  // Dev client / Expo Go have no update channel — checking throws.
  if (__DEV__ || !Updates.isEnabled) return;

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Offline or server hiccup — the stale bundle still works; next launch retries.
  }
}
