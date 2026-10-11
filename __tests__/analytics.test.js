import { logEvent, getSessionStats } from "../src/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";

beforeEach(() => {
  AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("logEvent", () => {
  test("persists an event to AsyncStorage", async () => {
    await logEvent("app_open");
    const raw = await AsyncStorage.getItem("sa_analytics");
    const events = JSON.parse(raw);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("app_open");
    expect(events[0].ts).toBeDefined();
  });

  test("persists extra props alongside name and ts", async () => {
    await logEvent("alert_triggered", { cause: "eyes_closed" });
    const raw = await AsyncStorage.getItem("sa_analytics");
    const events = JSON.parse(raw);
    expect(events[0].cause).toBe("eyes_closed");
  });

  test("appends multiple events in order", async () => {
    await logEvent("app_open");
    await logEvent("alert_triggered", { cause: "low_blink_rate" });
    const raw = await AsyncStorage.getItem("sa_analytics");
    const events = JSON.parse(raw);
    expect(events).toHaveLength(2);
    expect(events[0].name).toBe("app_open");
    expect(events[1].name).toBe("alert_triggered");
  });

  test("caps stored events at 500", async () => {
    for (let i = 0; i < 510; i++) await logEvent("app_open");
    const raw = await AsyncStorage.getItem("sa_analytics");
    const events = JSON.parse(raw);
    expect(events.length).toBe(500);
  });
});

describe("getSessionStats", () => {
  test("returns zero counts when no events stored", async () => {
    const stats = await getSessionStats();
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalAlerts).toBe(0);
    expect(stats.alertsByType).toEqual({});
  });

  test("counts app_open as sessions and alert_triggered as alerts", async () => {
    await logEvent("app_open");
    await logEvent("app_open");
    await logEvent("alert_triggered", { cause: "eyes_closed" });
    await logEvent("alert_triggered", { cause: "low_blink_rate" });
    await logEvent("alert_triggered", { cause: "eyes_closed" });

    const stats = await getSessionStats();
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalAlerts).toBe(3);
    expect(stats.alertsByType).toEqual({ eyes_closed: 2, low_blink_rate: 1 });
  });

  test("ignores unrelated events in counts", async () => {
    await logEvent("disclaimer_accepted");
    await logEvent("model_loaded");
    const stats = await getSessionStats();
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalAlerts).toBe(0);
  });

  test("handles AsyncStorage read failure gracefully", async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error("disk error"));
    const stats = await getSessionStats();
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalAlerts).toBe(0);
  });
});
