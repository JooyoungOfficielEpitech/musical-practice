import React, { memo, useRef, useCallback, useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
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
  // Initial colors only — later theme changes arrive via a setTheme message so
  // the WebView never reloads (a reload re-renders OSMD and resets the cursor).
  const cursorColor = isDark ? "#F59E0B" : "#D97706";
  const bgColor = isDark ? "#1A1815" : "#FFFFFF";
  const textColor = isDark ? "#FAFAF9" : "#1C1917";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow-x:hidden; background:${bgColor} !important; color:${textColor}; margin:0; padding:16px; }
    #score { width:100%; min-height:100%; }
    #error { display:none; padding:16px; color:#DC2626; font-family:sans-serif; font-size:14px; }
  </style>
</head>
<body>
  <div id="score"></div>
  <div id="error"></div>
  <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js"><\/script>
  <script>
    var osmd=null,timeTable=[],currentStep=0,cursorColor='${cursorColor}';
    function sendMsg(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
    console.log('[InteractiveScore:WebView] JS init ok, waiting for loadXml');
    function showErr(e){document.getElementById('error').style.display='block';document.getElementById('error').textContent=e;sendMsg({type:'error',message:e});}
    function buildTimeTable(){
      timeTable=[];
      if(!osmd||!osmd.cursor)return;
      var bpm=(osmd.Sheet&&osmd.Sheet.DefaultStartTempoInBpm)||120;
      var secPerWholeNote=4*60/bpm;
      // Anchor each measure to a fixed bar length from its time signature — the
      // SAME shared bar grid the audio player uses — so the cursor stays locked to
      // the sound even when OMR produced a measure with the wrong beat count.
      var measures=(osmd.Sheet&&osmd.Sheet.SourceMeasures)||[];
      var ok=measures.length>0;
      var gridMs=[0],measWhole=[],barWhole=1.0;
      for(var i=0;i<measures.length;i++){
        var sig=measures[i].ActiveTimeSignature;
        if(sig&&sig.Numerator&&sig.Denominator){barWhole=sig.Numerator/sig.Denominator;}
        var aw=measures[i].AbsoluteTimestamp;
        if(aw&&typeof aw.RealValue==='number'){measWhole.push(aw.RealValue);}else{measWhole.push(0);ok=false;}
        gridMs.push(gridMs[i]+barWhole*secPerWholeNote*1000);
      }
      var steps=[];
      osmd.cursor.reset();
      while(!osmd.cursor.Iterator.EndReached){
        var it=osmd.cursor.Iterator;
        var tw=(it.currentTimeStamp&&typeof it.currentTimeStamp.realValue==='number')?it.currentTimeStamp.realValue:0;
        var mi=it.CurrentMeasureIndex;
        if(typeof mi!=='number'||mi<0||mi>gridMs.length-2){ok=false;mi=Math.max(0,Math.min(mi||0,gridMs.length-2));}
        var intra=tw-(measWhole[mi]||0);if(intra<0)intra=0;
        var t=gridMs[mi]+intra*secPerWholeNote*1000;
        if(mi+1<gridMs.length&&t>gridMs[mi+1])t=gridMs[mi+1];
        if(!isFinite(t)){ok=false;t=tw*secPerWholeNote*1000;}
        steps.push(t);
        osmd.cursor.next();
      }
      osmd.cursor.reset();
      if(ok){timeTable=steps;return;}
      // Fallback: OSMD layout API not shaped as expected — plain per-step grid.
      timeTable=[];osmd.cursor.reset();
      while(!osmd.cursor.Iterator.EndReached){var ts=osmd.cursor.Iterator.currentTimeStamp;timeTable.push(((ts&&ts.realValue)||0)*secPerWholeNote*1000);osmd.cursor.next();}
      osmd.cursor.reset();
    }
    function stepCursor(step){if(!osmd||!osmd.cursor)return;if(step<currentStep){osmd.cursor.reset();currentStep=0;}while(currentStep<step&&!osmd.cursor.Iterator.EndReached){osmd.cursor.next();currentStep++;}osmd.cursor.show();var el=osmd.cursor.cursorElement;if(el){el.style.backgroundColor='rgba(37,99,235,0.12)';el.style.borderLeft='4px solid '+cursorColor;el.style.boxShadow='0 0 8px rgba(37,99,235,0.8)';el.style.opacity='1';el.scrollIntoView({behavior:'smooth',block:'nearest'});}}
    function seekToMs(ms){if(!osmd||!osmd.cursor||timeTable.length===0)return;var lo=0,hi=timeTable.length-1,step=0;while(lo<=hi){var mid=(lo+hi)>>1;if(timeTable[mid]<=ms){step=mid;lo=mid+1;}else{hi=mid-1;}}if(step===currentStep)return;sendMsg({type:'debug',msg:'seek ms='+ms.toFixed(0)+' step='+step+' tbl='+timeTable[step].toFixed(0)+' prev='+currentStep});stepCursor(step);}
    function clickInit(){var sc=document.getElementById('score');if(!sc)return;sc.addEventListener('click',function(e){if(!osmd||!osmd.cursor)return;var cx=e.pageX,cy=e.pageY,best=-1,dist=Infinity;osmd.cursor.reset();var i=0;while(!osmd.cursor.Iterator.EndReached){var el=osmd.cursor.cursorElement;if(el){var r=el.getBoundingClientRect(),cX=r.left+r.width/2+window.scrollX,cY=r.top+r.height/2+window.scrollY,d=Math.sqrt(Math.pow(cx-cX,2)+Math.pow(cy-cY,2));if(d<dist){dist=d;best=i;}}osmd.cursor.next();i++;}if(best>=0&&dist<80){stepCursor(best);sendMsg({type:'notePress',noteIndex:best});}});}
    function loadXml(xml){currentStep=0;try{if(!osmd)osmd=new opensheetmusicdisplay.OpenSheetMusicDisplay('score',{autoResize:true,backend:'svg',drawTitle:false,drawComposer:false,drawCredits:false,drawPartNames:false,drawPartAbbreviations:false,zoom:0.65});osmd.load(xml).then(function(){osmd.render();osmd.cursor.show();stepCursor(0);buildTimeTable();clickInit();sendMsg({type:'ready'});sendMsg({type:'debug',tbl0:timeTable[0],tbl1:timeTable[1],tbl10:timeTable[10],tblN:timeTable[timeTable.length-1],len:timeTable.length,bpm:(osmd.Sheet&&osmd.Sheet.DefaultStartTempoInBpm)||120});}).catch(function(e){showErr('Render failed: '+e.message);});}catch(e){showErr('Load failed: '+e.message);}}
    function setVisibleParts(indices){if(!osmd||!osmd.Sheet)return;try{var inst=osmd.Sheet.Instruments;for(var i=0;i<inst.length;i++){inst[i].Visible=indices.indexOf(i)>=0;}osmd.render();}catch(e){sendMsg({type:'debug',msg:'setVisibleParts failed: '+e.message});}}
    function setTheme(dark){
      cursorColor=dark?'#F59E0B':'#D97706';
      document.body.style.background=dark?'#1A1815':'#FFFFFF';
      document.body.style.color=dark?'#FAFAF9':'#1C1917';
      var el=osmd&&osmd.cursor&&osmd.cursor.cursorElement;
      if(el){el.style.borderLeft='4px solid '+cursorColor;}
    }
    function handleMsg(m){
      if(m.type==='loadXml'){loadXml(m.xml);}
      else if(m.type==='setPositionMs'){seekToMs(m.positionMs);}
      else if(m.type==='setVisibleParts'){setVisibleParts(m.visibleIndices);}
      else if(m.type==='setTheme'){setTheme(!!m.isDark);}
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
  const handleWebViewLoadRef = useRef<() => void>(() => {});

  // Build the HTML ONCE with the theme at mount. A source change would reload
  // the WebView (full OSMD re-render, cursor reset), so later theme toggles go
  // through a setTheme message instead.
  const initialDarkRef = useRef(isDark);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHtml(initialDarkRef.current), []);

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

  // Store the latest handleWebViewLoad function for retry button
  useEffect(() => {
    handleWebViewLoadRef.current = handleWebViewLoad;
  }, [handleWebViewLoad]);

  // Latest theme for the ready-handler — declared before handleMessage closes over it.
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

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
            // Theme may have flipped while OSMD was loading — sync it now.
            sendToWebView({ type: "setTheme", isDark: isDarkRef.current });
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
    [onReady, onNotePress, sendToWebView],
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

  // Live theme switch — restyle in place instead of reloading the WebView
  useEffect(() => {
    if (!readyRef.current) return;
    sendToWebView({ type: "setTheme", isDark });
  }, [isDark, sendToWebView]);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      accessibilityRole="image"
      accessibilityLabel="Musical score"
      accessibilityLiveRegion="polite"
    >
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
        <SafeAreaView style={[styles.overlayBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.overlayText, { color: colors.text }]}>Loading score...</Text>
          </View>
        </SafeAreaView>
      )}
      {error && (
        <SafeAreaView
          style={[styles.overlayBackdrop, { backgroundColor: colors.overlay }]}
          accessible={true}
          accessibilityRole="alert"
        >
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            <Pressable
              onPress={() => {
                setError(null);
                setLoading(true);
                handleWebViewLoadRef.current();
              }}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="Retry loading score"
              accessibilityRole="button"
            >
              <Text style={[styles.retryBtnText, { color: colors.buttonText }]}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { borderRadius: BorderRadius.sm, overflow: "hidden", flex: 1 },
  webView: { flex: 1, backgroundColor: "transparent" },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  overlayText: { ...Typography.body, textAlign: "center" },
  errorOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  errorText: { ...Typography.body, textAlign: "center" },
  retryBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 100,
  },
  retryBtnText: { ...Typography.body, fontWeight: "600" },
});
