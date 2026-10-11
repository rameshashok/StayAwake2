import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet } from "react-native";

export function PostAlertBanner({ visible }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[s.banner, { opacity }]}>
      <Text style={s.text}>🛑  Consider taking a break — your safety matters.</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: "absolute", bottom: 80, left: 20, right: 20,
    backgroundColor: "rgba(79,70,229,0.92)", borderRadius: 14,
    padding: 16, alignItems: "center",
  },
  text: { color: "#fff", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
