import React, { memo, useRef, useCallback, useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface InteractiveScoreProps {
  musicXml: string;
  positionMs?: number;   // score time (ms) — drives cursor position directly
  visiblePartIndices?: number[];
  onNotePress?: (noteIndex: number) => void;
  onReady?: () => void;
}

type WebViewIncoming =
  | { type: "ready" }
  | { type: "notePress"; noteIndex: number }
  | { type: "error"; message: string }
  | { type: "debug"; tbl0?: number; tbl1?: number; tbl10?: number; tblN?: number; len?: number; bpm?: number; msg?: string };

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
    var osmd=null,timeTable=[],currentStep=0;
    function sendMsg(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
    console.log('[InteractiveScore:WebView] JS init ok, waiting for loadXml');
    function showErr(e){document.getElementById('error').style.display='block';document.getElementById('error').textContent=e;sendMsg({type:'error',message:e});}
    function buildTimeTable(){timeTable=[];if(!osmd||!osmd.cursor)return;var bpm=(osmd.Sheet&&osmd.Sheet.DefaultStartTempoInBpm)||120;var secPerWholeNote=4*60/bpm;osmd.cursor.reset();while(!osmd.cursor.Iterator.EndReached){var ts=osmd.cursor.Iterator.currentTimeStamp;timeTable.push(ts.realValue*secPerWholeNote*1000);osmd.cursor.next();}osmd.cursor.reset();}
    function stepCursor(step){if(!osmd||!osmd.cursor)return;if(step<currentStep){osmd.cursor.reset();currentStep=0;}while(currentStep<step&&!osmd.cursor.Iterator.EndReached){osmd.cursor.next();currentStep++;}osmd.cursor.show();var el=osmd.cursor.cursorElement;if(el){el.style.backgroundColor='rgba(37,99,235,0.12)';el.style.borderLeft='3px solid ${cursorColor}';el.style.opacity='1';el.scrollIntoView({behavior:'instant',block:'nearest'});}}
    function seekToMs(ms){if(!osmd||!osmd.cursor||timeTable.length===0)return;var lo=0,hi=timeTable.length-1,step=0;while(lo<=hi){var mid=(lo+hi)>>1;if(timeTable[mid]<=ms){step=mid;lo=mid+1;}else{hi=mid-1;}}if(step===currentStep)return;sendMsg({type:'debug',msg:'seek ms='+ms.toFixed(0)+' step='+step+' tbl='+timeTable[step].toFixed(0)+' prev='+currentStep});stepCursor(step);}
    function clickInit(){var sc=document.getElementById('score');if(!sc)return;sc.addEventListener('click',function(e){if(!osmd||!osmd.cursor)return;var cx=e.pageX,cy=e.pageY,best=-1,dist=Infinity;osmd.cursor.reset();var i=0;while(!osmd.cursor.Iterator.EndReached){var el=osmd.cursor.cursorElement;if(el){var r=el.getBoundingClientRect(),cX=r.left+r.width/2+window.scrollX,cY=r.top+r.height/2+window.scrollY,d=Math.sqrt(Math.pow(cx-cX,2)+Math.pow(cy-cY,2));if(d<dist){dist=d;best=i;}}osmd.cursor.next();i++;}if(best>=0&&dist<80){stepCursor(best);sendMsg({type:'notePress',noteIndex:best});}});}
    function loadXml(xml){currentStep=0;try{if(!osmd)osmd=new opensheetmusicdisplay.OpenSheetMusicDisplay('score',{autoResize:true,backend:'svg',drawTitle:false,drawComposer:false,drawCredits:false,drawPartNames:false,drawPartAbbreviations:false,zoom:0.65});osmd.load(xml).then(function(){osmd.render();osmd.cursor.show();stepCursor(0);buildTimeTable();clickInit();sendMsg({type:'ready'});sendMsg({type:'debug',tbl0:timeTable[0],tbl1:timeTable[1],tbl10:timeTable[10],tblN:timeTable[timeTable.length-1],len:timeTable.length,bpm:(osmd.Sheet&&osmd.Sheet.DefaultStartTempoInBpm)||120});}).catch(function(e){showErr('Render failed: '+e.message);});}catch(e){showErr('Load failed: '+e.message);}}
    function setVisibleParts(indices){if(!osmd||!osmd.Sheet)return;var inst=osmd.Sheet.Instruments;for(var i=0;i<inst.length;i++){inst[i].Visible=indices.indexOf(i)>=0;}osmd.render();}
    function handleMsg(m){
      if(m.type==='loadXml'){loadXml(m.xml);}
      else if(m.type==='setPositionMs'){seekToMs(m.positionMs);}
      else if(m.type==='setVisibleParts'){setVisibleParts(m.visibleIndices);}
    }
    window.addEventListener('message',function(e){try{handleMsg(JSON.parse(e.data));}catch(e){}});
    document.addEventListener('message',function(e){try{handleMsg(JSON.parse(e.data));}catch(e){}});
  <\/script>
</body>
</html>`;
}

export const InteractiveScore = memo(function InteractiveScore({
  musicXml,
  positionMs,
  visiblePartIndices,
  onNotePress,
  onReady,
}: InteractiveScoreProps) {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readyRef = useRef(false);

  const html = useMemo(() => buildHtml(isDark), [isDark]);

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
            console.log("[InteractiveScore] WebView ready — OSMD rendered");
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
          case "debug":
            if(data.msg){console.log('[InteractiveScore]',data.msg);}else{console.log(`[InteractiveScore] timeTable bpm=${data.bpm} len=${data.len} t[0]=${data.tbl0?.toFixed(0)}ms t[1]=${data.tbl1?.toFixed(0)}ms t[10]=${data.tbl10?.toFixed(0)}ms t[last]=${data.tblN?.toFixed(0)}ms`);}
            break;
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onReady, onNotePress],
  );

  // Send cursor position to WebView whenever positionMs changes
  const prevPositionRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!readyRef.current) return;
    if (positionMs === undefined || positionMs === prevPositionRef.current) return;
    prevPositionRef.current = positionMs;
    console.log(`[InteractiveScore] sending positionMs=${positionMs?.toFixed(0)}ms`);
    sendToWebView({ type: "setPositionMs", positionMs });
  }, [positionMs, sendToWebView]);

  // Update part visibility when visiblePartIndices changes
  useEffect(() => {
    if (visiblePartIndices === undefined || !readyRef.current) return;
    sendToWebView({ type: "setVisibleParts", visibleIndices: visiblePartIndices });
  }, [visiblePartIndices, sendToWebView]);

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
