import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { initErrorReporting } from "./src/errorReporting";
import { logEvent } from "./src/analytics";
import { useDetectionLoop, SIM_STATES } from "./src/hooks/useDetectionLoop";
import { useDisclaimer } from "./src/hooks/useDisclaimer";
import { useKeepAwake } from "./src/hooks/useKeepAwake";
import { DisclaimerModal } from "./src/components/DisclaimerModal";
import { OnboardingScreen } from "./src/components/OnboardingScreen";
import { SimControls } from "./src/components/SimControls";
import { SettingsSheet } from "./src/components/SettingsSheet";
import { PostAlertBanner } from "./src/components/PostAlertBanner";

initErrorReporting();
logEvent("app_open");

const IS_WEB = Platform.OS === "web";

export default function App() {
  const {
    modelReady, modelError,
    status, reason,
    permission, webCamError,
    calibProgress,
    simMode, simState, simStateRef,
    cameraRef, videoRef,
    toggleSimMode, dismissAlert,
    resetCalibration, applySettings,
  } = useDetectionLoop();

  const { showOnboarding, finishOnboarding, showDisclaimer, acceptDisclaimer } = useDisclaimer();

  const [localSimState, setLocalSimState] = useState("open");
  const [showSettings, setShowSettings]   = useState(false);
  const [showBanner, setShowBanner]       = useState(false);
  const [titleTaps, setTitleTaps]         = useState(0);

  // Keep screen on while monitoring
  useKeepAwake(modelReady && !showOnboarding && !showDisclaimer);

  const handleDismissAlert = async () => {
    await dismissAlert();
    setShowBanner(true);
    setTimeout(() => setShowBanner(false), 3500);
  };

  // Secret tap to reveal sim mode (dev only — 5 taps on title)
  const handleTitleTap = () => {
    if (!__DEV__) return;
    const next = titleTaps + 1;
    setTitleTaps(next);
    if (next >= 5) { toggleSimMode(); setTitleTaps(0); }
  };

  if (showOnboarding) {
    return <OnboardingScreen onDone={finishOnboarding} />;
  }

  const CameraView = IS_WEB ? null : require("expo-camera").CameraView;

  return (
    <View style={s.container}>
      <StatusBar style="light" />

      {IS_WEB ? (
        <View style={s.camera}>
          <video
            ref={videoRef}
            style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover",
              display: simMode ? "none" : "block" }}
            muted playsInline
          />
          {simMode && <Text style={s.simLabel}>[ Simulation Mode ]</Text>}
          {!simMode && webCamError && <Text style={s.errorLabel}>{webCamError}</Text>}
        </View>
      ) : !simMode && CameraView && permission ? (
        <CameraView style={s.camera} facing="front" ref={cameraRef} />
      ) : !simMode && permission === false ? (
        <View style={s.camera}>
          <Text style={s.errorLabel}>{"Camera permission denied.\nEnable it in Settings to use live detection."}</Text>
        </View>
      ) : (
        <View style={s.camera}>
          {simMode && <Text style={s.simLabel}>[ Simulation Mode ]</Text>}
        </View>
      )}

      <View style={s.overlay}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleTitleTap} activeOpacity={1}>
            <Text style={s.title}>StayAwake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.settingsBtn} onPress={() => setShowSettings(true)}>
            <Text style={s.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {modelError ? (
          <View style={s.statusBox}>
            <Text style={s.errorLabel}>{modelError}</Text>
          </View>
        ) : !modelReady ? (
          <View style={s.statusBox}>
            <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
            <Text style={s.statusText}>Loading ML model...</Text>
          </View>
        ) : calibProgress < 1 && !simMode ? (
          <View style={s.calibBox}>
            <Text style={s.calibText}>Calibrating... keep eyes open</Text>
            <View style={s.calibBarBg}>
              <View style={[s.calibBarFill, { width: `${calibProgress * 100}%` }]} />
            </View>
          </View>
        ) : status === "drowsy" ? (
          <View style={s.alertBox}>
            <Text style={s.alertIcon}>⚠️</Text>
            <Text style={s.alertText}>Stay Alert</Text>
            <Text style={s.alertReason}>{reason}</Text>
            <Text style={s.alertDisclaimer}>Consider taking a break if you feel tired.</Text>
            <TouchableOpacity style={s.dismissBtn} onPress={handleDismissAlert}>
              <Text style={s.btnText}>I'm Awake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.statusBox}>
              <View style={[s.dot, { backgroundColor: simMode ? SIM_STATES[simState].color : "#00e676" }]} />
              <Text style={s.statusText}>
                {simMode ? SIM_STATES[simState].label : "Monitoring..."}
              </Text>
            </View>
            {simMode && (
              <SimControls
                simState={localSimState}
                simStateRef={simStateRef}
                setSimState={setLocalSimState}
              />
            )}
          </>
        )}

        <Text style={s.footerDisclaimer}>
          Supplemental aid only — not a substitute for safe driving practices.
        </Text>
      </View>

      <PostAlertBanner visible={showBanner} />

      <DisclaimerModal visible={showDisclaimer} onAccept={acceptDisclaimer} />

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onResetCalibration={resetCalibration}
        onSettingsChange={applySettings}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#1a1a2e" },
  camera:          { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000", overflow: "hidden" },
  simLabel:        { color: "#333", fontSize: 14 },
  errorLabel:      { color: "#e53935", fontSize: 13, textAlign: "center", padding: 20 },
  overlay:         { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between", padding: 40 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  title:           { color: "#fff", fontSize: 28, fontWeight: "bold" },
  settingsBtn:     { padding: 8 },
  settingsIcon:    { fontSize: 22 },
  statusBox:       { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  dot:             { width: 12, height: 12, borderRadius: 6, backgroundColor: "#00e676", marginRight: 8 },
  statusText:      { color: "#fff", fontSize: 16 },
  alertBox:        { backgroundColor: "rgba(200,0,0,0.85)", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 30 },
  alertIcon:       { fontSize: 48, marginBottom: 8 },
  alertText:       { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 6 },
  alertReason:     { color: "#ffd", fontSize: 15, marginBottom: 20 },
  alertDisclaimer: { color: "rgba(255,255,200,0.7)", fontSize: 12, marginBottom: 16, textAlign: "center" },
  dismissBtn:      { backgroundColor: "#fff", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 30 },
  btnText:         { color: "#1a1a2e", fontWeight: "bold", fontSize: 16 },
  calibBox:        { alignItems: "center", marginBottom: 30 },
  calibText:       { color: "#fff", fontSize: 14, marginBottom: 8 },
  calibBarBg:      { width: 200, height: 6, backgroundColor: "#333", borderRadius: 3 },
  calibBarFill:    { height: 6, backgroundColor: "#00e676", borderRadius: 3 },
  footerDisclaimer:{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", paddingBottom: 8 },
});
