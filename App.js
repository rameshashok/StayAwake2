import React, { useRef, useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform, Modal, ScrollView, Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DrowsinessDetector } from "./src/drowsinessDetector";
import { AlertService } from "./src/AlertService";
import { initErrorReporting, captureError } from "./src/errorReporting";
import { logEvent } from "./src/analytics";

initErrorReporting();

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
  const [simMode, setSimMode]       = useState(false);
  const [simState, setSimState]     = useState("open");
  const [permission, setPermission] = useState(null);
  const [webCamError, setWebCamError] = useState(null);
  const [calibProgress, setCalibProgress] = useState(0);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [modelError, setModelError] = useState(null);

  const cameraRef   = useRef(null);
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);
  const loopRef     = useRef(null);
  const runningRef  = useRef(false);
  const simStateRef = useRef("open");
  const simModeRef  = useRef(false);
  const statusRef   = useRef("monitoring");

  const handleDrowsy = useCallback(async (cause) => {
    statusRef.current = "drowsy";
    setStatus("drowsy");
    setReason(cause === "eyes_closed" ? "Your eyes have been closed for a while." : "Reduced blink activity detected.");
    logEvent("alert_triggered", { cause });
    await alertService.start();
  }, []);

  // Show disclaimer on first launch
  useEffect(() => {
    logEvent("app_open");
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.getItem("disclaimer_accepted").then((val) => {
      if (!val) setShowDisclaimer(true);
    });
  }, []);

  const acceptDisclaimer = () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.setItem("disclaimer_accepted", "1");
    logEvent("disclaimer_accepted");
    setShowDisclaimer(false);
  };

  // Load model on mount
  useEffect(() => {
    detectorRef.current = new DrowsinessDetector(handleDrowsy);

    const { loadModel } = require("./src/mlModel");
    loadModel()
      .then(() => {
        setModelReady(true);
        logEvent("model_loaded");
      })
      .catch((err) => {
        captureError(err, { context: "loadModel" });
        setModelError("Failed to load detection model. Check your connection and restart.");
      });

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

      if (statusRef.current !== "drowsy") {
        if (simModeRef.current) {
          // Simulation path
          const { ear: earVal } = SIM_STATES[simStateRef.current];
          const pts = makeFakeKeypoints(earVal);
          detectorRef.current?.processKeypoints(pts);

        } else if (IS_WEB) {
          try {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              const { detectLandmarks } = require("./src/mlModel");
              const keypoints = await detectLandmarks(videoRef.current);
              if (keypoints) {
                const result = detectorRef.current?.processKeypoints(keypoints);
                if (result != null) {
                  if (result?.calibrating) {
                    setCalibProgress(result.progress);
                  } else {
                    setCalibProgress(1);
                  }
                }
              }
            }
          } catch (_) { /* skip frame */ }

        } else if (!IS_WEB && cameraRef.current && permission) {
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
            if (result != null) {
              setCalibProgress(result.calibrating ? result.progress : 1);
            }
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
    setCalibProgress(next ? 1 : 0);
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
  };

  const dismissAlert = async () => {
    await alertService.stop();
    logEvent("alert_dismissed");
    setStatus("monitoring");
    setReason("");
    statusRef.current = "monitoring";
    setCalibProgress(0);
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
              display: simMode ? "none" : "block" }}
            muted playsInline
          />
          {simMode && <Text style={styles.simLabel}>[ Simulation Mode ]</Text>}
          {!simMode && webCamError && <Text style={styles.errorLabel}>{webCamError}</Text>}
        </View>
      ) : !simMode && CameraView && permission ? (
        <CameraView style={styles.camera} facing="front" ref={cameraRef} />
      ) : !simMode && permission === false ? (
        <View style={styles.camera}>
          <Text style={styles.errorLabel}>{"Camera permission denied.\nEnable it in Settings to use live detection."}</Text>
        </View>
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

        {modelError ? (
          <View style={styles.statusBox}>
            <Text style={styles.errorLabel}>{modelError}</Text>
          </View>
        ) : !modelReady ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.statusText}>Loading ML model...</Text>
          </View>
        ) : calibProgress < 1 && !simMode ? (
          <View style={styles.calibBox}>
            <Text style={styles.calibText}>Calibrating... keep eyes open</Text>
            <View style={styles.calibBarBg}>
              <View style={[styles.calibBarFill, { width: `${calibProgress * 100}%` }]} />
            </View>
          </View>
        ) : status === "drowsy" ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertText}>Stay Alert</Text>
            <Text style={styles.alertReason}>{reason}</Text>
            <Text style={styles.alertDisclaimer}>Consider taking a break if you feel tired.</Text>
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
        <Text style={styles.footerDisclaimer}>
          Supplemental aid only — not a substitute for safe driving practices.
        </Text>
      </View>

      <Modal visible={showDisclaimer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>⚠️ Important Disclaimer</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              <Text style={styles.modalBody}>
                StayAwake is a <Text style={styles.bold}>supplemental driver assistance tool</Text> only.{"\n\n"}
                It is <Text style={styles.bold}>not</Text> a substitute for attentive, safe driving. It may not detect all instances of drowsiness and should never be relied upon as your sole means of staying alert.{"\n\n"}
                If you feel tired, <Text style={styles.bold}>pull over and rest</Text>. No app can replace good judgment.{"\n\n"}
                By continuing, you acknowledge that you use this app at your own risk and that the developers are not liable for any incidents while driving.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalBtn} onPress={acceptDisclaimer}>
              <Text style={styles.modalBtnText}>I Understand — Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL("https://github.com/rameshashok/stayawake/blob/main/PRIVACY_POLICY.md")}>
              <Text style={styles.privacyLink}>View Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  calibBox:     { alignItems: "center", marginBottom: 30 },
  calibText:    { color: "#fff", fontSize: 14, marginBottom: 8 },
  calibBarBg:   { width: 200, height: 6, backgroundColor: "#333", borderRadius: 3 },
  calibBarFill: { height: 6, backgroundColor: "#00e676", borderRadius: 3 },
  simControls:  { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 20, marginBottom: 30, alignItems: "center" },
  simTitle:     { color: "#aaa", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  simButtons:   { flexDirection: "row", gap: 10, marginBottom: 12 },
  simBtn:       { backgroundColor: "#2a2a4a", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#444" },
  simBtnText:   { color: "#fff", fontSize: 13 },
  simHint:      { color: "#666", fontSize: 12, textAlign: "center" },
  btnText:          { color: "#1a1a2e", fontWeight: "bold", fontSize: 16 },
  alertDisclaimer:  { color: "rgba(255,255,200,0.7)", fontSize: 12, marginBottom: 16, textAlign: "center" },
  footerDisclaimer: { color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", paddingBottom: 8 },
  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalBox:         { backgroundColor: "#1e1e3a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420 },
  modalTitle:       { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  modalBody:        { color: "#ccc", fontSize: 14, lineHeight: 22 },
  bold:             { fontWeight: "bold", color: "#fff" },
  modalBtn:         { backgroundColor: "#4f46e5", borderRadius: 30, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  modalBtnText:     { color: "#fff", fontWeight: "bold", fontSize: 15 },
  privacyLink:      { color: "#a78bfa", fontSize: 13, textAlign: "center", marginTop: 14, textDecorationLine: "underline" },
});
