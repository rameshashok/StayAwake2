import React, { useRef, useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DrowsinessDetector } from "./src/drowsinessDetector";
import { AlertService } from "./src/AlertService";

const IS_WEB = Platform.OS === "web";
const alertService = new AlertService();
const FRAME_INTERVAL_MS = 150;

// --- Simulation helpers ---
function makeFakeKeypoints(ear) {
  const v = ear * 30;
  const pts = Array.from({ length: 68 }, (_, i) => ({ x: i * 10, y: 0 }));
  pts[36] = { x: 0,  y: 0  }; pts[37] = { x: 10, y: -v };
  pts[38] = { x: 20, y: -v }; pts[39] = { x: 30, y: 0  };
  pts[40] = { x: 20, y: v  }; pts[41] = { x: 10, y: v  };
  pts[42] = { x: 0,  y: 0  }; pts[43] = { x: 10, y: -v };
  pts[44] = { x: 20, y: -v }; pts[45] = { x: 30, y: 0  };
  pts[46] = { x: 20, y: v  }; pts[47] = { x: 10, y: v  };
  return pts;
}

const SIM_STATES = {
  open:    { label: "👁  Eyes Open",   ear: 0.35, color: "#00e676" },
  closing: { label: "😑 Eyes Closing", ear: 0.22, color: "#ffb300" },
  closed:  { label: "😴 Eyes Closed",  ear: 0.10, color: "#e53935" },
};

export default function App() {
  const [modelReady, setModelReady] = useState(false);
  const [status, setStatus]         = useState("monitoring");
  const [reason, setReason]         = useState("");
  const [ear, setEar]               = useState(null);
  const [simMode, setSimMode]       = useState(false);
  const [simState, setSimState]     = useState("open");
  const [permission, setPermission] = useState(null);
  const [webCamError, setWebCamError] = useState(null);

  const cameraRef   = useRef(null);  // native CameraView ref
  const videoRef    = useRef(null);  // web <video> element ref
  const canvasRef   = useRef(null);  // web <canvas> element ref
  const streamRef   = useRef(null);  // web MediaStream ref
  const detectorRef = useRef(null);
  const loopRef     = useRef(null);
  const runningRef  = useRef(false);
  const simStateRef = useRef("open");
  const simModeRef  = useRef(false);

  const handleDrowsy = useCallback(async (cause) => {
    setStatus("drowsy");
    setReason(cause === "eyes_closed" ? "Eyes closed too long!" : "Low blink rate detected!");
    await alertService.start();
  }, []);

  // Load model on mount
  useEffect(() => {
    detectorRef.current = new DrowsinessDetector(handleDrowsy);

    const { loadModel } = require("./src/mlModel");
    loadModel().then(() => setModelReady(true));

    if (!IS_WEB) {
      import("expo-camera").then(({ Camera }) => {
        Camera.requestCameraPermissionsAsync().then(({ granted }) =>
          setPermission(granted)
        );
      });
    }

    return () => {
      runningRef.current = false;
      alertService.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [handleDrowsy]);

  // Start/stop web camera based on simMode
  useEffect(() => {
    if (!IS_WEB || !modelReady) return;

    if (!simMode) {
      // Wait a tick for the video element to be mounted in the DOM
      const { requestWebCamera } = require("./src/webCamera");
      setTimeout(() => {
        if (!videoRef.current) return;
        requestWebCamera(videoRef.current)
          .then((stream) => { streamRef.current = stream; setWebCamError(null); })
          .catch(() => setWebCamError("Camera access denied. Enable camera permission in your browser."));
      }, 100);
    } else {
      // Stop web camera when switching to sim
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
  }, [simMode, modelReady]);

  // Main detection loop
  useEffect(() => {
    if (!modelReady) return;
    runningRef.current = true;

    const loop = async () => {
      if (!runningRef.current) return;

      if (status !== "drowsy") {
        if (simModeRef.current) {
          // Simulation path
          const { ear: earVal } = SIM_STATES[simStateRef.current];
          const pts = makeFakeKeypoints(earVal);
          const result = detectorRef.current?.processKeypoints(pts);
          if (result != null) setEar(result.toFixed(2));

        } else if (IS_WEB) {
          // Web live camera path
          try {
            const { captureFrame } = require("./src/webCamera");
            const canvas = captureFrame(videoRef.current, canvasRef.current);
            if (canvas) {
              const { detectLandmarks } = require("./src/mlModel");
              const keypoints = await detectLandmarks(canvas);
              const result = detectorRef.current?.processKeypoints(keypoints);
              if (result != null) setEar(result.toFixed(2));
            }
          } catch (_) { /* skip frame */ }

        } else if (cameraRef.current && permission) {
          // Native live camera path
          try {
            const photo = await cameraRef.current.takePictureAsync({
              base64: false, quality: 0.2, skipProcessing: true, exif: false,
            });
            const response = await fetch(photo.uri);
            const buffer = await response.arrayBuffer();
            const jpeg = await import("jpeg-js");
            const { data, width, height } = jpeg.decode(new Uint8Array(buffer), { useTArray: true });
            const { detectLandmarks } = await import("./src/mlModel");
            const keypoints = await detectLandmarks({ data, width, height });
            const result = detectorRef.current?.processKeypoints(keypoints);
            if (result != null) setEar(result.toFixed(2));
          } catch (_) { /* skip frame */ }
        }
      }

      loopRef.current = setTimeout(loop, FRAME_INTERVAL_MS);
    };

    loop();
    return () => {
      runningRef.current = false;
      clearTimeout(loopRef.current);
    };
  }, [modelReady, permission]);

  const toggleSimMode = () => {
    const next = !simModeRef.current;
    simModeRef.current = next;
    setSimMode(next);
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
    setEar(null);
  };

  const dismissAlert = async () => {
    await alertService.stop();
    setStatus("monitoring");
    setReason("");
    simStateRef.current = "open";
    setSimState("open");
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
  };

  const CameraView = IS_WEB ? null : require("expo-camera").CameraView;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Camera feed */}
      {IS_WEB ? (
        <View style={styles.camera}>
          {/* Hidden video + canvas for ML frame capture */}
          <video
            ref={videoRef}
            style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover",
              transform: "scaleX(-1)", display: simMode ? "none" : "block" }}
            muted playsInline
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          {simMode && <Text style={styles.simLabel}>[ Simulation Mode ]</Text>}
          {!simMode && webCamError && <Text style={styles.errorLabel}>{webCamError}</Text>}
        </View>
      ) : !simMode && CameraView ? (
        <CameraView style={styles.camera} facing="front" ref={cameraRef} />
      ) : (
        <View style={styles.camera}>
          <Text style={styles.simLabel}>[ Simulation Mode ]</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>StayAwake</Text>
          <TouchableOpacity style={[styles.toggleBtn, simMode && styles.toggleActive]} onPress={toggleSimMode}>
            <Text style={styles.toggleText}>{simMode ? "🧪 Sim" : "📷 Live"}</Text>
          </TouchableOpacity>
        </View>

        {!modelReady ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.statusText}>Loading ML model...</Text>
          </View>
        ) : status === "drowsy" ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertText}>DROWSINESS DETECTED</Text>
            <Text style={styles.alertReason}>{reason}</Text>
            <TouchableOpacity style={styles.dismissBtn} onPress={dismissAlert}>
              <Text style={styles.btnText}>I'm Awake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statusBox}>
              <View style={[styles.dot, { backgroundColor: simMode ? SIM_STATES[simState].color : "#00e676" }]} />
              <Text style={styles.statusText}>
                {simMode ? SIM_STATES[simState].label : "Monitoring..."}
                {ear != null ? `   EAR: ${ear}` : ""}
              </Text>
            </View>

            {simMode && (
              <View style={styles.simControls}>
                <Text style={styles.simTitle}>Simulate Eye State</Text>
                <View style={styles.simButtons}>
                  {Object.entries(SIM_STATES).map(([key, val]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.simBtn, simState === key && { backgroundColor: val.color }]}
                      onPress={() => { simStateRef.current = key; setSimState(key); }}
                    >
                      <Text style={styles.simBtnText}>{val.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.simHint}>Hold "Eyes Closed" for 2s to trigger alert</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#1a1a2e" },
  camera:       { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000", overflow: "hidden" },
  simLabel:     { color: "#333", fontSize: 14 },
  errorLabel:   { color: "#e53935", fontSize: 13, textAlign: "center", padding: 20 },
  overlay:      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between", padding: 40 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  title:        { color: "#fff", fontSize: 28, fontWeight: "bold" },
  toggleBtn:    { backgroundColor: "#2a2a4a", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#444" },
  toggleActive: { backgroundColor: "#3a2a5a", borderColor: "#a78bfa" },
  toggleText:   { color: "#fff", fontSize: 13 },
  statusBox:    { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  dot:          { width: 12, height: 12, borderRadius: 6, backgroundColor: "#00e676", marginRight: 8 },
  statusText:   { color: "#fff", fontSize: 16 },
  alertBox:     { backgroundColor: "rgba(200,0,0,0.85)", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 30 },
  alertIcon:    { fontSize: 48, marginBottom: 8 },
  alertText:    { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 6 },
  alertReason:  { color: "#ffd", fontSize: 15, marginBottom: 20 },
  dismissBtn:   { backgroundColor: "#fff", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 30 },
  simControls:  { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 20, marginBottom: 30, alignItems: "center" },
  simTitle:     { color: "#aaa", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  simButtons:   { flexDirection: "row", gap: 10, marginBottom: 12 },
  simBtn:       { backgroundColor: "#2a2a4a", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#444" },
  simBtnText:   { color: "#fff", fontSize: 13 },
  simHint:      { color: "#666", fontSize: 12, textAlign: "center" },
  btnText:      { color: "#1a1a2e", fontWeight: "bold", fontSize: 16 },
});
