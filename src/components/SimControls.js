import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SIM_STATES } from "../hooks/useDetectionLoop";

export function SimControls({ simState, simStateRef, setSimState }) {
  return (
    <View style={s.container}>
      <Text style={s.title}>Simulate Eye State</Text>
      <View style={s.buttons}>
        {Object.entries(SIM_STATES).map(([key, val]) => (
          <TouchableOpacity
            key={key}
            style={[s.btn, simState === key && { backgroundColor: val.color }]}
            onPress={() => { simStateRef.current = key; setSimState(key); }}
          >
            <Text style={s.btnText}>{val.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.hint}>Hold "Eyes Closed" for 2s to trigger alert</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 20, marginBottom: 30, alignItems: "center" },
  title:     { color: "#aaa", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  buttons:   { flexDirection: "row", gap: 10, marginBottom: 12 },
  btn:       { backgroundColor: "#2a2a4a", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#444" },
  btnText:   { color: "#fff", fontSize: 13 },
  hint:      { color: "#666", fontSize: 12, textAlign: "center" },
});
