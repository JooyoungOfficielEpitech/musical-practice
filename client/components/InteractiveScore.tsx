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
  positionMs?: number;   // original score time (ms) — cursor seeks by time, not note index
  onNotePress?: (noteIndex: number) => void;
  onReady?: () => void;
}

type WebViewIncoming =
  | { type: "ready" }
  | { type: "notePress"; noteIndex: number }
  | { type: "error"; message: string };

function buildHtml(isDark: boolean): string {
  const cursorColor = isDark ? "#3B82F6" : "#2563EB";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow-x:hidden; background:#FFFFFF !important; color:#1F2937; margin:0; padding:16px; }
    #score { width:100%; min-height:100%; }
    #error { display:none; padding:16px; color:#DC2626; font-family:sans-serif; font-size:14px; }
  </style>
</head>
<body>
  <div id="score"></div>
  <div id="error"></div>
  <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js"><\/script>
  <script>
    var osmd=null,timeTable=[];function sendMsg(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
    function showErr(e){document.getElementById('error').style.display='block';document.getElementById('error').textContent=e;sendMsg({type:'error',message:e});}
    function buildTimeTable(){timeTable=[];if(!osmd||!osmd.cursor)return;var bpm=(osmd.Sheet&&osmd.Sheet.DefaultStartTempoInBpm)||120;var secPerWholeNote=4*60/bpm;osmd.cursor.reset();while(!osmd.cursor.Iterator.EndReached){var ts=osmd.cursor.Iterator.currentTimeStamp;timeTable.push(ts.realValue*secPerWholeNote*1000);osmd.cursor.next();}osmd.cursor.reset();}
    function stepCursor(step){if(!osmd||!osmd.cursor)return;osmd.cursor.reset();osmd.cursor.show();for(var i=0;i<step&&!osmd.cursor.Iterator.EndReached;i++)osmd.cursor.next();var el=osmd.cursor.cursorElement;if(el){el.style.backgroundColor='rgba(37,99,235,0.12)';el.style.borderLeft='3px solid ${cursorColor}';el.style.width='100%';el.style.opacity='1';el.scrollIntoView({behavior:'smooth',block:'center'});}}
    function seekToMs(ms){if(!osmd||!osmd.cursor||timeTable.length===0)return;var step=0;for(var i=timeTable.length-1;i>=0;i--){if(ms>=timeTable[i]){step=i;break;}}stepCursor(step);}
    function clickInit(){var sc=document.getElementById('score');if(!sc)return;sc.addEventListener('click',function(e){if(!osmd||!osmd.cursor)return;var cx=e.pageX,cy=e.pageY,best=-1,dist=Infinity;osmd.cursor.reset();var i=0;while(!osmd.cursor.Iterator.EndReached){var el=osmd.cursor.cursorElement;if(el){var r=el.getBoundingClientRect(),cX=r.left+r.width/2+window.scrollX,cY=r.top+r.height/2+window.scrollY,d=Math.sqrt(Math.pow(cx-cX,2)+Math.pow(cy-cY,2));if(d<dist){dist=d;best=i;}}osmd.cursor.next();i++;}if(best>=0&&dist<80){stepCursor(best);sendMsg({type:'notePress',noteIndex:best});}});}
    function loadXml(xml){try{if(!osmd)osmd=new opensheetmusicdisplay.OpenSheetMusicDisplay('score',{autoResize:true,backend:'svg',drawTitle:false,drawComposer:false,drawCredits:false,drawPartNames:false,drawPartAbbreviations:false});osmd.load(xml).then(function(){osmd.render();osmd.cursor.show();stepCursor(0);buildTimeTable();clickInit();sendMsg({type:'ready'});}).catch(function(e){showErr('Render failed: '+e.message);});}catch(e){showErr('Load failed: '+e.message);}}
    window.addEventListener('message',function(e){try{var m=JSON.parse(e.data);if(m.type==='loadXml')loadXml(m.xml);else if(m.type==='setPositionMs')seekToMs(m.positionMs);}catch(e){}});
    document.addEventListener('message',function(e){try{var m=JSON.parse(e.data);if(m.type==='loadXml')loadXml(m.xml);else if(m.type==='setPositionMs')seekToMs(m.positionMs);}catch(e){}});
  <\/script>
</body>
</html>`;
}

export const InteractiveScore = memo(function InteractiveScore({
  musicXml,
  positionMs,
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

  // Update cursor when playback position changes
  const prevPositionRef = useRef<number | undefined>(undefined);
  if (positionMs !== undefined && positionMs !== prevPositionRef.current && readyRef.current) {
    prevPositionRef.current = positionMs;
    sendToWebView({ type: "setPositionMs", positionMs });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webView}
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
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { borderRadius: BorderRadius.sm, overflow: "hidden", flex: 1 },
  webView: { flex: 1, backgroundColor: "transparent" },
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
  errorText: { ...Typography.body, textAlign: "center" },
});
