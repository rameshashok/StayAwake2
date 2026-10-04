import { Platform } from "react-native";

const IS_WEB = Platform.OS === "web";

let Haptics = null;
let Audio = null;
if (!IS_WEB) {
  Haptics = require("expo-haptics");
  Audio = require("expo-av").Audio;
}

export class AlertService {
  constructor() {
    this.sound = null;
    this.vibrationInterval = null;

    if (IS_WEB) {
      const asset = require("../assets/alert.mp3");
      this._audio = new Audio(typeof asset === "string" ? asset : asset.uri ?? asset);
      this._audio.loop = true;
      this._audio.volume = 1.0;
      this._unlocked = false;
      const unlock = () => {
        if (this._unlocked) return;
        // Play and immediately pause to satisfy autoplay policy
        this._audio.play().then(() => {
          this._audio.pause();
          this._audio.currentTime = 0;
          this._unlocked = true;
        }).catch(() => {});
      };
      document.addEventListener("touchstart", unlock, { once: true });
      document.addEventListener("click", unlock, { once: true });
    }
  }

  async start() {
    if (IS_WEB) {
      try {
        this._audio.currentTime = 0;
        await this._audio.play();
      } catch (_) {}
      return;
    }

    if (!Haptics) return;
    this.vibrationInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 400);

    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/alert.mp3"),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      this.sound = sound;
    } catch (_) {}
  }

  async stop() {
    if (IS_WEB) {
      this._audio.pause();
      this._audio.currentTime = 0;
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
