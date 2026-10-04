import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sa_analytics";
const MAX_EVENTS = 500;

async function getEvents() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function logEvent(name, props = {}) {
  try {
    const events = await getEvents();
    events.push({ name, ts: Date.now(), ...props });
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    await AsyncStorage.setItem(KEY, JSON.stringify(events));
  } catch {}
}

export async function getSessionStats() {
  const events = await getEvents();
  const alerts   = events.filter((e) => e.name === "alert_triggered");
  const sessions = events.filter((e) => e.name === "app_open");
  return {
    totalSessions: sessions.length,
    totalAlerts: alerts.length,
    alertsByType: alerts.reduce((acc, e) => {
      acc[e.cause] = (acc[e.cause] || 0) + 1;
      return acc;
    }, {}),
  };
}
