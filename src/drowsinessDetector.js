// face-api.js 68-point landmark indices
// Left eye:  36,37,38,39,40,41  → [p1,p2,p3,p4,p5,p6]
// Right eye: 42,43,44,45,46,47
// EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)

const LEFT_EYE  = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE = [42, 43, 44, 45, 46, 47];

const EAR_THRESHOLD  = 0.21;
const DROWSY_MS      = 2000;
const MIN_BLINKS_MIN = 8;

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
    this.blinkTimestamps = [];
    this.alertActive = false;
  }

  // positions: array of 68 {x,y} points from face-api.js
  processKeypoints(positions) {
    if (!positions || positions.length < 68) {
      this._reset();
      return null;
    }

    const ear = (eyeAspectRatio(positions, LEFT_EYE) + eyeAspectRatio(positions, RIGHT_EYE)) / 2;
    const eyesClosed = ear < EAR_THRESHOLD;
    const now = Date.now();

    if (eyesClosed) {
      if (!this.eyeClosedSince) {
        this.eyeClosedSince = now;
      } else if (now - this.eyeClosedSince >= DROWSY_MS && !this.alertActive) {
        this.alertActive = true;
        this.onDrowsy("eyes_closed");
      }
    } else {
      if (this.eyeClosedSince) {
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

    return ear;
  }

  _reset() {
    this.eyeClosedSince = null;
    this.alertActive = false;
  }
}
