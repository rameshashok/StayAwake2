import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Switch, Modal, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULTS = { sensitivity: "normal", soundEnabled: true };
const KEY = "sa_settings";

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

async function saveSettings(settings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

const SENSITIVITY_LEVELS = [
  { key: "low",    label: "Low",    desc: "3.5s to alert" },
  { key: "normal", label: "Normal", desc: "2s to alert" },
  { key: "high",   label: "High",   desc: "1s to alert" },
];

export function SettingsSheet({ visible, onClose, onResetCalibration }) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    if (visible) loadSettings().then(setSettings);
  }, [visible]);

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.heading}>Settings</Text>

        <Text style={s.label}>Alert Sensitivity</Text>
        <View style={s.row}>
          {SENSITIVITY_LEVELS.map(({ key, label, desc }) => (
            <TouchableOpacity
              key={key}
              style={[s.chip, settings.sensitivity === key && s.chipActive]}
              onPress={() => update({ sensitivity: key })}
            >
              <Text style={[s.chipLabel, settings.sensitivity === key && s.chipLabelActive]}>{label}</Text>
              <Text style={s.chipDesc}>{desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.switchRow}>
          <View>
            <Text style={s.label}>Alert Sound</Text>
            <Text style={s.sublabel}>Play audio when drowsiness is detected</Text>
          </View>
          <Switch
            value={settings.soundEnabled}
            onValueChange={(v) => update({ soundEnabled: v })}
            trackColor={{ true: "#4f46e5" }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity style={s.resetBtn} onPress={() => { onResetCalibration(); onClose(); }}>
          <Text style={s.resetText}>🔄  Reset Calibration</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:         { backgroundColor: "#1e1e3a", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:        { width: 40, height: 4, backgroundColor: "#444", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  heading:       { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 24 },
  label:         { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 10 },
  sublabel:      { color: "#666", fontSize: 12, marginTop: 2 },
  row:           { flexDirection: "row", gap: 10, marginBottom: 28 },
  chip:          { flex: 1, backgroundColor: "#2a2a4a", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#333" },
  chipActive:    { backgroundColor: "#312e81", borderColor: "#4f46e5" },
  chipLabel:     { color: "#aaa", fontWeight: "bold", fontSize: 13 },
  chipLabelActive: { color: "#fff" },
  chipDesc:      { color: "#555", fontSize: 11, marginTop: 4 },
  switchRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  resetBtn:      { backgroundColor: "#2a2a4a", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12 },
  resetText:     { color: "#a78bfa", fontSize: 14, fontWeight: "600" },
  closeBtn:      { backgroundColor: "#4f46e5", borderRadius: 30, padding: 16, alignItems: "center" },
  closeBtnText:  { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
