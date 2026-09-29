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
  const [modelReady, setModelReady]   = useState(false);
  const [status, setStatus]           = useState("monitoring");
  const [reason, setReason]           = useState("");
  const [ear, setEar]                 = useState(null);
  const [simMode, setSimMode]         = useState(IS_WEB); // ON by default on web
  const [simState, setSimState]       = useState("open");
  const [permission, setPermission]   = useState(null);   // native only

  const cameraRef    = useRef(null);
  const detectorRef  = useRef(null);
  const loopRef      = useRef(null);
  const runningRef   = useRef(false);
  const simStateRef  = useRef("open");
  const simModeRef   = useRef(IS_WEB);

  const handleDrowsy = useCallback(async (cause) => {
    setStatus("drowsy");
    setReason(cause === "eyes_closed" ? "Eyes closed too long!" : "Low blink rate detected!");
    await alertService.start();
  }, []);

  // Load model + request camera permission
  useEffect(() => {
    detectorRef.current = new DrowsinessDetector(handleDrowsy);

    if (!IS_WEB) {
      // Dynamically import native-only modules
      Promise.all([
        import("./src/mlModel").then((m) => m.loadModel()),
        import("expo-camera").then((m) => m.useCameraPermissions),
      ]).then(() => setModelReady(true));

      import("expo-camera").then(({ Camera }) => {
        Camera.requestCameraPermissionsAsync().then(({ granted }) =>
          setPermission(granted)
        );
      });
    } else {
      setModelReady(true);
    }

    return () => {
      runningRef.current = false;
      alertService.stop();
    };
  }, [handleDrowsy]);

  // Main detection loop
  useEffect(() => {
    if (!modelReady) return;
    runningRef.current = true;

    const loop = async () => {
      if (!runningRef.current) return;

      if (status !== "drowsy") {
        if (simModeRef.current) {
          // --- Simulation path ---
          const { ear: earVal } = SIM_STATES[simStateRef.current];
          const pts = makeFakeKeypoints(earVal);
          const result = detectorRef.current?.processKeypoints(pts);
          if (result != null) setEar(result.toFixed(2));
        } else if (!IS_WEB && cameraRef.current && permission) {
          // --- Real camera + ML path ---
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
    // Reset detector when switching modes
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
    setEar(null);
  };

  const changeSimState = (key) => {
    simStateRef.current = key;
    setSimState(key);
  };

  const dismissAlert = async () => {
    await alertService.stop();
    setStatus("monitoring");
    setReason("");
    simStateRef.current = "open";
    setSimState("open");
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
  };

  // Lazy-loaded CameraView for native
  const CameraView = IS_WEB ? null : require("expo-camera").CameraView;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Camera feed or sim placeholder */}
      {!IS_WEB && !simMode && CameraView ? (
        <CameraView style={styles.camera} facing="front" ref={cameraRef} />
      ) : (
        <View style={styles.camera}>
          <Text style={styles.simLabel}>[ Simulation Mode ]</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>StayAwake</Text>
          {/* Sim toggle — always visible */}
          <TouchableOpacity style={[styles.toggleBtn, simMode && styles.toggleActive]} onPress={toggleSimMode}>
            <Text style={styles.toggleText}>{simMode ? "🧪 Sim ON" : "📷 Live"}</Text>
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
                      onPress={() => changeSimState(key)}
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
  camera:       { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d0d1a" },
  simLabel:     { color: "#333", fontSize: 14 },
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
