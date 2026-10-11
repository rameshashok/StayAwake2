import React from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Linking, StyleSheet } from "react-native";
import { PRIVACY_POLICY_URL } from "../constants";

export function DisclaimerModal({ visible, onAccept }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.box}>
          <Text style={s.title}>⚠️ Important Disclaimer</Text>
          <ScrollView style={{ maxHeight: 260 }}>
            <Text style={s.body}>
              StayAwake is a <Text style={s.bold}>supplemental driver assistance tool</Text> only.{"\n\n"}
              It is <Text style={s.bold}>not</Text> a substitute for attentive, safe driving. It may not detect all instances of drowsiness and should never be relied upon as your sole means of staying alert.{"\n\n"}
              If you feel tired, <Text style={s.bold}>pull over and rest</Text>. No app can replace good judgment.{"\n\n"}
              By continuing, you acknowledge that you use this app at your own risk and that the developers are not liable for any incidents while driving.
            </Text>
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={onAccept}>
            <Text style={s.btnText}>I Understand — Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text style={s.privacyLink}>View Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 24 },
  box:         { backgroundColor: "#1e1e3a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420 },
  title:       { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  body:        { color: "#ccc", fontSize: 14, lineHeight: 22 },
  bold:        { fontWeight: "bold", color: "#fff" },
  btn:         { backgroundColor: "#4f46e5", borderRadius: 30, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  btnText:     { color: "#fff", fontWeight: "bold", fontSize: 15 },
  privacyLink: { color: "#a78bfa", fontSize: 13, textAlign: "center", marginTop: 14, textDecorationLine: "underline" },
});
