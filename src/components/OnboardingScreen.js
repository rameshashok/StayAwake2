import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

const SLIDES = [
  {
    icon: "👁",
    title: "Real-Time Eye Monitoring",
    body: "StayAwake uses your front camera to track your eye movements and detect signs of drowsiness while you drive.",
  },
  {
    icon: "🎯",
    title: "Personal Calibration",
    body: "On each session, the app spends 3 seconds learning your natural eye openness. Keep your eyes open during calibration for best accuracy.",
  },
  {
    icon: "🔔",
    title: "Instant Alerts",
    body: "If your eyes close for too long or your blink rate drops, you'll get a loud sound and vibration alert. Tap \"I'm Awake\" to dismiss.",
  },
  {
    icon: "📱",
    title: "Keep the App Open",
    body: "Detection only works while StayAwake is on screen. If your phone locks or you switch apps, monitoring pauses. Mount your phone where you can see it.",
  },
];

export function OnboardingScreen({ onDone }) {
  const [index, setIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const scrollRef = useRef(null);

  const goTo = (i) => {
    setIndex(i);
    if (slideWidth) scrollRef.current?.scrollTo({ x: i * slideWidth, animated: true });
  };

  const next = () => {
    if (index < SLIDES.length - 1) goTo(index + 1);
    else onDone();
  };

  return (
    <View style={s.container}>
      <View style={s.scrollWrapper} onLayout={(e) => setSlideWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollRef}
          horizontal pagingEnabled scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
        >
          {SLIDES.map((slide, i) => (
            <View key={i} style={[s.slide, slideWidth ? { width: slideWidth } : null]}>
              <Text style={s.icon}>{slide.icon}</Text>
              <Text style={s.title}>{slide.title}</Text>
              <Text style={s.body}>{slide.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === index && s.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={s.btn} onPress={next}>
        <Text style={s.btnText}>
          {index < SLIDES.length - 1 ? "Next" : "Get Started"}
        </Text>
      </TouchableOpacity>

      {index < SLIDES.length - 1 && (
        <TouchableOpacity onPress={onDone}>
          <Text style={s.skip}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  scrollWrapper:{ alignSelf: "stretch", overflow: "hidden" },
  slide:        { paddingHorizontal: 40, alignItems: "center" },
  icon:      { fontSize: 72, marginBottom: 24 },
  title:     { color: "#fff", fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  body:      { color: "#aaa", fontSize: 15, lineHeight: 24, textAlign: "center" },
  dots:      { flexDirection: "row", gap: 8, marginTop: 40, marginBottom: 32 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#333" },
  dotActive: { backgroundColor: "#00e676", width: 24 },
  btn:       { backgroundColor: "#4f46e5", paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30, marginBottom: 16 },
  btnText:   { color: "#fff", fontWeight: "bold", fontSize: 16 },
  skip:      { color: "#555", fontSize: 14 },
});
