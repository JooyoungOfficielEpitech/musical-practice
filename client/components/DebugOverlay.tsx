/**
 * TEMPORARY debug overlay for the sync-bug hunt. A floating 🐞 button opens a
 * panel with live player state and the event log; "Copy" shares the full dump
 * so it can be pasted straight into a bug report. Remove together with
 * client/lib/debug/ once the hunt is over (gated on DEBUG_TOOLS_ENABLED).
 */
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Share, StyleSheet } from "react-native";
import {
  DEBUG_TOOLS_ENABLED,
  getDebugEntries,
  subscribeDebugLog,
  clearDebugLog,
  dumpDebugLog,
} from "@/lib/debug/debugLog";

interface DebugOverlayProps {
  /** Live values shown at the top of the panel and included in the dump. */
  snapshot: Record<string, string | number | boolean | null | undefined>;
}

export function DebugOverlay({ snapshot }: DebugOverlayProps) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeDebugLog(() => setTick((t) => t + 1));
  }, [open]);

  const handleCopy = useCallback(() => {
    Share.share({ message: dumpDebugLog(snapshot) }).catch(() => {});
  }, [snapshot]);

  if (!DEBUG_TOOLS_ENABLED) return null;

  if (!open) {
    return (
      <Pressable
        style={styles.fab}
        onPress={() => setOpen(true)}
        accessibilityLabel="Open debug panel"
        testID="debug-fab"
      >
        <Text style={styles.fabText}>🐞</Text>
      </Pressable>
    );
  }

  const entries = getDebugEntries();
  return (
    <View style={styles.panel} testID="debug-panel">
      <View style={styles.header}>
        <Text style={styles.title}>DEBUG</Text>
        <Pressable onPress={handleCopy} style={styles.btn} testID="debug-copy">
          <Text style={styles.btnText}>Copy</Text>
        </Pressable>
        <Pressable onPress={() => clearDebugLog()} style={styles.btn}>
          <Text style={styles.btnText}>Clear</Text>
        </Pressable>
        <Pressable onPress={() => setOpen(false)} style={styles.btn} testID="debug-close">
          <Text style={styles.btnText}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.snapshot}>
        {Object.entries(snapshot).map(([k, v]) => (
          <Text key={k} style={styles.mono}>
            {k}: {String(v)}
          </Text>
        ))}
      </View>
      <ScrollView style={styles.log}>
        {[...entries].reverse().map((e, i) => (
          <Text key={`${e.t}-${i}`} style={styles.mono}>
            {new Date(e.t).toISOString().slice(11, 23)} [{e.tag}] {e.msg}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 12,
    bottom: 120,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  fabText: { fontSize: 18 },
  panel: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 90,
    height: 320,
    borderRadius: 12,
    backgroundColor: "rgba(10,10,10,0.92)",
    padding: 10,
    zIndex: 999,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { color: "#F59E0B", fontWeight: "700", flex: 1, fontSize: 12 },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  btnText: { color: "#FFF", fontSize: 12 },
  snapshot: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#444", paddingBottom: 4, marginBottom: 4 },
  log: { flex: 1 },
  mono: { color: "#D6D3D1", fontSize: 10, fontFamily: "Courier", lineHeight: 14 },
});
