import React, { memo, useRef, useCallback, useState } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  useWindowDimensions,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface InteractiveScoreProps {
  musicXml: string;
  currentNoteIndex?: number;
  onNotePress?: (noteIndex: number) => void;
  onReady?: () => void;
}

type WebViewIncoming =
  | { type: "ready" }
  | { type: "notePress"; noteIndex: number }
  | { type: "error"; message: string };

function buildHtml(isDark: boolean): string {
  const bg = "#FFFFFF";
  const fg = "#1F2937";
  const cursorColor = isDark ? "#3B82F6" : "#2563EB";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow-x:hidden; background:${bg}; color:${fg}; }
    #score { width:100%; min-height:100%; }
    #error { display:none; padding:16px; color:#DC2626; font-family:sans-serif; font-size:14px; }
  </style>
</head>
<body>
  <div id="score"></div>
  <div id="error"></div>
  <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js"></script>
  <script>
    (function() {
      var osmd = null;
      var cursorNotes = [];

      function sendMessage(msg) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }

      function showError(message) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = message;
        sendMessage({ type: 'error', message: message });
      }

      function collectCursorNotes() {
        cursorNotes = [];
        if (!osmd || !osmd.cursor) return;
        osmd.cursor.reset();
        var idx = 0;
        while (!osmd.cursor.Iterator.EndReached) {
          cursorNotes.push(idx);
          osmd.cursor.next();
          idx++;
        }
        osmd.cursor.reset();
      }

      function setCursorPosition(noteIndex) {
        if (!osmd || !osmd.cursor) return;
        osmd.cursor.reset();
        osmd.cursor.show();
        for (var i = 0; i < noteIndex && !osmd.cursor.Iterator.EndReached; i++) {
          osmd.cursor.next();
        }
        var el = osmd.cursor.cursorElement;
        if (el) {
          el.style.background = '${cursorColor}';
          el.style.opacity = '0.4';
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      function setupNoteClickHandlers() {
        var svgContainer = document.getElementById('score');
        if (!svgContainer) return;
        svgContainer.addEventListener('click', function(e) {
          if (!osmd || !osmd.cursor) return;
          var clickX = e.pageX;
          var clickY = e.pageY;
          var bestIdx = -1;
          var bestDist = Infinity;

          osmd.cursor.reset();
          var idx = 0;
          while (!osmd.cursor.Iterator.EndReached) {
            var el = osmd.cursor.cursorElement;
            if (el) {
              var rect = el.getBoundingClientRect();
              var cx = rect.left + rect.width / 2 + window.scrollX;
              var cy = rect.top + rect.height / 2 + window.scrollY;
              var dist = Math.sqrt(Math.pow(clickX - cx, 2) + Math.pow(clickY - cy, 2));
              if (dist < bestDist) {
                bestDist = dist;
                bestIdx = idx;
              }
            }
            osmd.cursor.next();
            idx++;
          }

          if (bestIdx >= 0 && bestDist < 80) {
            setCursorPosition(bestIdx);
            sendMessage({ type: 'notePress', noteIndex: bestIdx });
          }
        });
      }

      function loadXml(xml) {
        try {
          if (!osmd) {
            osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay('score', {
              autoResize: true,
              backend: 'svg',
              drawTitle: false,
              drawComposer: false,
              drawCredits: false,
              drawPartNames: false,
              drawPartAbbreviations: false,
            });
          }
          osmd.load(xml).then(function() {
            osmd.render();
            osmd.cursor.show();
            osmd.cursor.cursorElement.style.background = '${cursorColor}';
            osmd.cursor.cursorElement.style.opacity = '0.4';
            collectCursorNotes();
            setupNoteClickHandlers();
            sendMessage({ type: 'ready' });
          }).catch(function(err) {
            showError('Failed to render score: ' + err.message);
          });
        } catch(err) {
          showError('Failed to load score: ' + err.message);
        }
      }

      window.addEventListener('message', function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === 'loadXml') {
            loadXml(msg.xml);
          } else if (msg.type === 'setCursor') {
            setCursorPosition(msg.noteIndex);
          }
        } catch(err) {}
      });

      document.addEventListener('message', function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === 'loadXml') {
            loadXml(msg.xml);
          } else if (msg.type === 'setCursor') {
            setCursorPosition(msg.noteIndex);
          }
        } catch(err) {}
      });
    })();
  </script>
</body>
</html>`;
}

export const InteractiveScore = memo(function InteractiveScore({
  musicXml,
  currentNoteIndex,
  onNotePress,
  onReady,
}: InteractiveScoreProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readyRef = useRef(false);

  const html = buildHtml(isDark);

  const sendToWebView = useCallback(
    (message: Record<string, unknown>) => {
      webViewRef.current?.postMessage(JSON.stringify(message));
    },
    [],
  );

  const handleWebViewLoad = useCallback(() => {
    if (musicXml) {
      sendToWebView({ type: "loadXml", xml: musicXml });
    }
  }, [musicXml, sendToWebView]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data: WebViewIncoming = JSON.parse(event.nativeEvent.data);
        switch (data.type) {
          case "ready":
            readyRef.current = true;
            setLoading(false);
            setError(null);
            onReady?.();
            break;
          case "notePress":
            onNotePress?.(data.noteIndex);
            break;
          case "error":
            setError(data.message);
            setLoading(false);
            break;
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onReady, onNotePress],
  );

  // Update cursor position when currentNoteIndex changes
  const prevNoteIndexRef = useRef<number | undefined>(undefined);
  if (
    currentNoteIndex !== undefined &&
    currentNoteIndex !== prevNoteIndexRef.current &&
    readyRef.current
  ) {
    prevNoteIndexRef.current = currentNoteIndex;
    sendToWebView({ type: "setCursor", noteIndex: currentNoteIndex });
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={[styles.webView, { width: width - Spacing.xl * 2 }]}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled
        onLoad={handleWebViewLoad}
        onMessage={handleMessage}
        onError={() => {
          setError("Failed to load score viewer");
          setLoading(false);
        }}
      />
      {loading && !error && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    minHeight: 300,
  },
  webView: {
    minHeight: 300,
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  errorText: {
    ...Typography.body,
    textAlign: "center",
  },
});
