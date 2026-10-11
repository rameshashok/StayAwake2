import { DrowsinessDetector } from "../src/drowsinessDetector";

// Build 68 keypoints that produce a known EAR.
// EAR = (dist(p2,p6) + dist(p3,p5)) / (2 * dist(p1,p4))
// With p1=(0,0), p4=(2,0) → denom = 4
// p2=(0.5, -v), p6=(1.5, v) → dist = sqrt(1 + 4v²)
// p3=(1, -v),   p5=(1, v)   → dist = 2v
// For small v: EAR ≈ (sqrt(1+4v²) + 2v) / 4
// We just need "open" EAR >> "closed" EAR, so use v=0.5 (open) and v=0.01 (closed).
function makeKeypoints(v) {
  const pts = Array.from({ length: 68 }, () => ({ x: 0, y: 0 }));
  const setEye = (i) => {
    pts[i[0]] = { x: 0,   y: 0  };
    pts[i[1]] = { x: 0.5, y: -v };
    pts[i[2]] = { x: 1,   y: -v };
    pts[i[3]] = { x: 2,   y: 0  };
    pts[i[4]] = { x: 1,   y: v  };
    pts[i[5]] = { x: 0.5, y: v  };
  };
  setEye([36, 37, 38, 39, 40, 41]);
  setEye([42, 43, 44, 45, 46, 47]);
  return pts;
}

const OPEN_V   = 0.5;   // eyes open
const CLOSED_V = 0.01;  // eyes closed

// Bypass the 3-second calibration window by back-dating calibrationStart
// and feeding one open-eye frame to trigger threshold computation.
function skipCalibration(detector, v = OPEN_V) {
  detector.calibrationStart = Date.now() - 4000;
  detector.calibrationSamples = [computeEAR(v), computeEAR(v), computeEAR(v)];
  detector.processKeypoints(makeKeypoints(v));
}

function computeEAR(v) {
  const p1 = { x: 0, y: 0 }, p4 = { x: 2, y: 0 };
  const p2 = { x: 0.5, y: -v }, p6 = { x: 0.5, y: v };
  const p3 = { x: 1, y: -v },   p5 = { x: 1, y: v };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
}

// ─── Calibration ─────────────────────────────────────────────────────────────

describe("calibration", () => {
  test("returns calibrating=true with progress during calibration window", () => {
    const d = new DrowsinessDetector(jest.fn());
    const result = d.processKeypoints(makeKeypoints(OPEN_V));
    expect(result.calibrating).toBe(true);
    expect(result.progress).toBeGreaterThanOrEqual(0);
    expect(result.progress).toBeLessThanOrEqual(1);
  });

  test("sets threshold to 85% of average open-eye EAR after calibration", () => {
    const d = new DrowsinessDetector(jest.fn());
    const openEAR = computeEAR(OPEN_V);
    skipCalibration(d, OPEN_V);
    expect(d.threshold).toBeCloseTo(openEAR * 0.85, 4);
  });

  test("restarts calibration if all samples are zero", () => {
    const d = new DrowsinessDetector(jest.fn());
    d.calibrationStart = Date.now() - 4000;
    d.calibrationSamples = [0, 0, 0];
    const result = d.processKeypoints(makeKeypoints(0));
    expect(result.calibrating).toBe(true);
    expect(result.progress).toBe(0);
    // Confirm detector reset its window for a fresh calibration attempt
    expect(d.calibrationSamples).toHaveLength(0);
  });
});

// ─── Eyes-closed detection ───────────────────────────────────────────────────

describe("eyes-closed detection", () => {
  test("does not fire alert when eyes are open", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);
    for (let i = 0; i < 20; i++) d.processKeypoints(makeKeypoints(OPEN_V));
    expect(onDrowsy).not.toHaveBeenCalled();
  });

  test("fires eyes_closed alert after DROWSY_MS of closed eyes", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    d.processKeypoints(makeKeypoints(CLOSED_V));
    expect(onDrowsy).not.toHaveBeenCalled();

    d.eyeClosedSince = Date.now() - 2100;
    d.processKeypoints(makeKeypoints(CLOSED_V));

    expect(onDrowsy).toHaveBeenCalledWith("eyes_closed");
  });

  test("does not fire alert twice for the same closed-eye event", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    d.eyeClosedSince = Date.now() - 2100;
    d.processKeypoints(makeKeypoints(CLOSED_V));
    d.processKeypoints(makeKeypoints(CLOSED_V));

    expect(onDrowsy).toHaveBeenCalledTimes(1);
  });

  test("resets eyeClosedSince after eyes reopen and confirm period passes", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    // Record a closed-eye event then immediately open
    d.eyeClosedSince = Date.now() - 100;
    // eyesOpenSince already 500ms ago → confirmedOpen = true
    d.eyesOpenSince = Date.now() - 500;
    d.processKeypoints(makeKeypoints(OPEN_V));

    expect(d.eyeClosedSince).toBeNull();
  });
});

// ─── Face-loss tolerance ─────────────────────────────────────────────────────

describe("face loss tolerance", () => {
  test("keeps eyeClosedSince alive during short face-loss burst", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    d.processKeypoints(makeKeypoints(CLOSED_V));
    const closedSince = d.eyeClosedSince;

    // Face lost briefly — lastDetectedAt is recent so timer survives
    d.processKeypoints(null);

    expect(d.eyeClosedSince).toBe(closedSince);
  });

  test("clears eyeClosedSince after MAX_MISS_MS of no face", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    d.processKeypoints(makeKeypoints(CLOSED_V));
    // Alert already fired — skip the DROWSY_MS branch so MAX_MISS_MS clear is reached
    d.alertActive = true;
    d.lastDetectedAt = Date.now() - 3000;
    d.eyeClosedSince = Date.now() - 3000;

    d.processKeypoints(null);

    expect(d.eyeClosedSince).toBeNull();
  });
});

// ─── Blink rate ───────────────────────────────────────────────────────────────

describe("blink rate", () => {
  test("fires low_blink_rate alert when blinks/min drops below 8 after 30s", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    const now = Date.now();
    // 3 blinks over 31s = ~5.8 blinks/min (below threshold of 8)
    d.blinkTimestamps = [now - 31000, now - 20000, now - 10000];
    // No active closed-eye timer so only blink-rate path runs
    d.eyeClosedSince = null;

    d.processKeypoints(makeKeypoints(OPEN_V));

    expect(onDrowsy).toHaveBeenCalledWith("low_blink_rate");
  });

  test("does not fire low_blink_rate before 30s window", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    const now = Date.now();
    d.blinkTimestamps = [now - 10000, now - 5000];

    d.processKeypoints(makeKeypoints(OPEN_V));

    expect(onDrowsy).not.toHaveBeenCalled();
  });

  test("does not fire low_blink_rate when blink rate is sufficient", () => {
    const onDrowsy = jest.fn();
    const d = new DrowsinessDetector(onDrowsy);
    skipCalibration(d, OPEN_V);

    const now = Date.now();
    // 8 blinks over 31s = ~15.5 blinks/min (above threshold of 8)
    d.blinkTimestamps = Array.from({ length: 8 }, (_, i) => now - 31000 + i * 3800);

    d.processKeypoints(makeKeypoints(OPEN_V));

    expect(onDrowsy).not.toHaveBeenCalled();
  });
});
