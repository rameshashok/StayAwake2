import { useRef, useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { DrowsinessDetector } from "../drowsinessDetector";
import { AlertService } from "../AlertService";
import { logEvent } from "../analytics";
import { captureError } from "../errorReporting";
import { loadSettings } from "../components/SettingsSheet";

const SENSITIVITY_MS = { low: 3500, normal: 2000, high: 1000 };

const IS_WEB = Platform.OS === "web";
const FRAME_INTERVAL_MS = 150;

const alertService = new AlertService();

export const SIM_STATES = {
  open:    { label: "👁  Eyes Open",   ear: 0.35, color: "#00e676" },
  closing: { label: "😑 Eyes Closing", ear: 0.22, color: "#ffb300" },
  closed:  { label: "😴 Eyes Closed",  ear: 0.10, color: "#e53935" },
};

function makeFakeKeypoints(ear) {
  const v = ear * 30;
  const pts = Array.from({ length: 68 }, (_, i) => ({ x: i * 10, y: 0 }));
  pts[36] = { x: 0,  y: 0  }; pts[37] = { x: 10, y: -v };
  pts[38] = { x: 20, y: -v }; pts[39] = { x: 30, y: 0  };
  pts[40] = { x: 20, y: v  }; pts[41] = { x: 10, y: v  };
  pts[42] = { x: 0,  y: 0  }; pts[43] = { x: 10, y: -v };
  pts[44] = { x: 20, y: -v }; pts[45] = { x: 30, y: 0  };
  pts[46] = { x: 20, y: v  }; pts[47] = { x: 10, y: v  };
  return pts;
}

export function useDetectionLoop() {
  const [modelReady, setModelReady]       = useState(false);
  const [modelError, setModelError]       = useState(null);
  const [status, setStatus]               = useState("monitoring");
  const [reason, setReason]               = useState("");
  const [permission, setPermission]       = useState(null);
  const [webCamError, setWebCamError]     = useState(null);
  const [calibProgress, setCalibProgress] = useState(0);
  const [simMode, setSimMode]             = useState(false);
  const [simState, setSimState]           = useState("open");
  const [soundEnabled, setSoundEnabled]   = useState(true);

  const cameraRef    = useRef(null);
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const detectorRef  = useRef(null);
  const loopRef      = useRef(null);
  const runningRef   = useRef(false);
  const simStateRef  = useRef("open");
  const simModeRef   = useRef(false);
  const statusRef    = useRef("monitoring");
  const sensitivityRef = useRef(2000);

  const handleDrowsy = useCallback(async (cause) => {
    statusRef.current = "drowsy";
    setStatus("drowsy");
    setReason(cause === "eyes_closed"
      ? "Your eyes have been closed for a while."
      : "Reduced blink activity detected.");
    logEvent("alert_triggered", { cause });
    await alertService.start();
  }, []);

  // Init model + camera permission
  useEffect(() => {
    loadSettings().then(({ sensitivity, soundEnabled: se }) => {
      sensitivityRef.current = SENSITIVITY_MS[sensitivity] ?? 2000;
      setSoundEnabled(se);
    });
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
    const { loadModel } = require("../mlModel");
    loadModel()
      .then(() => { setModelReady(true); logEvent("model_loaded"); })
      .catch((err) => {
        captureError(err, { context: "loadModel" });
        setModelError("Failed to load detection model. Check your connection and restart.");
      });

    if (IS_WEB) {
      // Request camera immediately so browser shows the permission prompt right away
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          setWebCamError(null);
          // Attach to video element once it's mounted
          const attach = () => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            } else {
              setTimeout(attach, 100);
            }
          };
          attach();
        })
        .catch(() => setWebCamError("Camera access denied. Enable camera permission in your browser."));
    } else {
      import("expo-camera").then(({ Camera }) =>
        Camera.requestCameraPermissionsAsync().then(({ granted }) => setPermission(granted))
      );
    }

    return () => {
      runningRef.current = false;
      alertService.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [handleDrowsy]);

  // Web camera start/stop (sim mode toggle)
  useEffect(() => {
    if (!IS_WEB || !modelReady) return;
    if (!simMode) {
      // Stream may already be running from the early request — just reattach
      if (streamRef.current && videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [simMode, modelReady]);

  // Detection loop
  useEffect(() => {
    if (!modelReady) return;
    runningRef.current = true;

    const loop = async () => {
      if (!runningRef.current) return;

      if (statusRef.current !== "drowsy") {
        if (simModeRef.current) {
          const { ear } = SIM_STATES[simStateRef.current];
          detectorRef.current?.processKeypoints(makeFakeKeypoints(ear));

        } else if (IS_WEB) {
          try {
            if (videoRef.current?.readyState >= 2) {
              const { detectLandmarks } = require("../mlModel");
              const keypoints = await detectLandmarks(videoRef.current);
              if (keypoints) {
                const result = detectorRef.current?.processKeypoints(keypoints);
                if (result != null) setCalibProgress(result.calibrating ? result.progress : 1);
              }
            }
          } catch (_) {}

        } else if (cameraRef.current && permission) {
          try {
            const photo = await cameraRef.current.takePictureAsync({
              base64: false, quality: 0.2, skipProcessing: true, exif: false,
            });
            const buffer = await (await fetch(photo.uri)).arrayBuffer();
            const jpeg = await import("jpeg-js");
            const { data, width, height } = jpeg.decode(new Uint8Array(buffer), { useTArray: true });
            const { detectLandmarks } = await import("../mlModel");
            const keypoints = await detectLandmarks({ data, width, height });
            const result = detectorRef.current?.processKeypoints(keypoints);
            if (result != null) setCalibProgress(result.calibrating ? result.progress : 1);
          } catch (_) {}
        }
      }

      loopRef.current = setTimeout(loop, FRAME_INTERVAL_MS);
    };

    loop();
    return () => { runningRef.current = false; clearTimeout(loopRef.current); };
  }, [modelReady, permission]);

  const resetCalibration = () => {
    setCalibProgress(0);
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
  };

  const applySettings = ({ sensitivity, soundEnabled: se }) => {
    sensitivityRef.current = SENSITIVITY_MS[sensitivity] ?? 2000;
    setSoundEnabled(se);
  };

  const toggleSimMode = () => {
    const next = !simModeRef.current;
    simModeRef.current = next;
    setSimMode(next);
    setCalibProgress(next ? 1 : 0);
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
  };

  const dismissAlert = async () => {
    await alertService.stop();
    logEvent("alert_dismissed");
    statusRef.current = "monitoring";
    setStatus("monitoring");
    setReason("");
    setCalibProgress(0);
    simStateRef.current = "open";
    setSimState("open");
    detectorRef.current = new DrowsinessDetector(handleDrowsy);
  };

  return {
    modelReady, modelError,
    status, reason,
    permission, webCamError,
    calibProgress,
    simMode, simState, simStateRef,
    cameraRef, videoRef,
    toggleSimMode, dismissAlert,
    resetCalibration, applySettings, soundEnabled,
  };
}
