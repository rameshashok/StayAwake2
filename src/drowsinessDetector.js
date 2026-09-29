const LEFT_EYE  = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE = [42, 43, 44, 45, 46, 47];

const DROWSY_MS        = 2000;
const MIN_BLINKS_MIN   = 8;
const CALIBRATION_MS   = 3000;
const CLOSED_RATIO     = 0.85;
const MAX_MISS_MS      = 2500;  // keep timer alive through face-loss bursts
const OPEN_CONFIRM_MS  = 400;   // eyes must be open for 400ms before resetting timer

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(pts, idx) {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => pts[i]);
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
}

export class DrowsinessDetector {
  constructor(onDrowsy) {
    this.onDrowsy = onDrowsy;
    this.eyeClosedSince = null;
    this.lastDetectedAt = null;
    this.blinkTimestamps = [];
    this.alertActive = false;
    this.calibrating = true;
    this.calibrationStart = Date.now();
    this.calibrationSamples = [];
    this.threshold = null;
    this.eyesOpenSince = null;
  }

  processKeypoints(positions) {
    const now = Date.now();

    if (!positions || positions.length < 68) {
      this.eyesOpenSince = null;
      if (this.eyeClosedSince && !this.alertActive) {
        if (now - this.eyeClosedSince >= DROWSY_MS) {
          this.alertActive = true;
          this.onDrowsy("eyes_closed");
        }
        return null;
      }
      if (this.eyeClosedSince && this.lastDetectedAt &&
          now - this.lastDetectedAt > MAX_MISS_MS) {
        this.eyeClosedSince = null;
      }
      return null;
    }

    this.lastDetectedAt = now;

    const ear = (eyeAspectRatio(positions, LEFT_EYE) + eyeAspectRatio(positions, RIGHT_EYE)) / 2;

    // Calibration phase
    if (this.calibrating) {
      this.calibrationSamples.push(ear);
      const elapsed = now - this.calibrationStart;
      if (elapsed >= CALIBRATION_MS) {
        const avg = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
        this.threshold = avg * CLOSED_RATIO;
        this.calibrating = false;
      }
      return { ear, calibrating: true, progress: Math.min(elapsed / CALIBRATION_MS, 1) };
    }

    const eyesClosed = ear < this.threshold;

    if (eyesClosed) {
      this.eyesOpenSince = null;
      if (!this.eyeClosedSince) {
        this.eyeClosedSince = now;
      } else if (now - this.eyeClosedSince >= DROWSY_MS && !this.alertActive) {
        this.alertActive = true;
        this.onDrowsy("eyes_closed");
      }
    } else {
      if (!this.eyesOpenSince) this.eyesOpenSince = now;
      const confirmedOpen = now - this.eyesOpenSince >= OPEN_CONFIRM_MS;
      if (this.eyeClosedSince && confirmedOpen) {
        this.blinkTimestamps.push(now);
        this.eyeClosedSince = null;
        this.alertActive = false;
      }

      this.blinkTimestamps = this.blinkTimestamps.filter((t) => now - t < 60000);

      if (this.blinkTimestamps.length > 0) {
        const windowSec = (now - this.blinkTimestamps[0]) / 1000;
        if (windowSec >= 30) {
          const blinksPerMin = (this.blinkTimestamps.length / windowSec) * 60;
          if (blinksPerMin < MIN_BLINKS_MIN && !this.alertActive) {
            this.alertActive = true;
            this.onDrowsy("low_blink_rate");
          }
        }
      }
    }

    return { ear, threshold: this.threshold, eyesClosed };
  }
}
