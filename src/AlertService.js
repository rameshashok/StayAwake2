import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

export class AlertService {
  constructor() {
    this.sound = null;
    this.vibrationInterval = null;
  }

  async start() {
    this.vibrationInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 400);

    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/alert.mp3"),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      this.sound = sound;
    } catch (_) {
      // sound file missing or unsupported — vibration still works
    }
  }

  async stop() {
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
