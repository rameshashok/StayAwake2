import { Platform } from "react-native";

const IS_WEB = Platform.OS === "web";

export class AlertService {
  constructor() {
    this.sound = null;
    this.vibrationInterval = null;

    if (IS_WEB) {
      this._ctx = null;
      this._buffer = null;
      this._source = null;
      this._unlocked = false;

      // Fetch and decode the mp3 into an AudioBuffer
      const asset = require("../assets/alert.mp3");
      const url = typeof asset === "string" ? asset : (asset.uri ?? String(asset));
      this._bufferReady = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((ab) => {
          this._ctx = new (window.AudioContext || window.webkitAudioContext)();
          return this._ctx.decodeAudioData(ab);
        })
        .then((buf) => { this._buffer = buf; })
        .catch(() => {});

      // Unlock AudioContext on first user gesture
      const unlock = () => {
        if (this._unlocked) return;
        if (this._ctx && this._ctx.state === "suspended") {
          this._ctx.resume().then(() => { this._unlocked = true; });
        } else {
          this._unlocked = true;
        }
      };
      document.addEventListener("touchstart", unlock);
      document.addEventListener("click", unlock);
    }
  }

  async start() {
    if (IS_WEB) {
      await this._bufferReady;
      if (!this._buffer || !this._ctx) return;
      if (this._ctx.state === "suspended") await this._ctx.resume();
      this._source = this._ctx.createBufferSource();
      this._source.buffer = this._buffer;
      this._source.loop = true;
      this._source.connect(this._ctx.destination);
      this._source.start(0);
      return;
    }

    const Haptics = require("expo-haptics");
    this.vibrationInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 400);

    try {
      const { Audio } = require("expo-av");
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/alert.mp3"),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      this.sound = sound;
    } catch (_) {}
  }

  async stop() {
    if (IS_WEB) {
      try { this._source?.stop(); } catch (_) {}
      this._source = null;
      return;
    }

    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }
}
