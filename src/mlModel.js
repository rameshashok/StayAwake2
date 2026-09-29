import { Platform } from "react-native";

const IS_WEB = Platform.OS === "web";

let ready = false;
let faceLandmarker = null;  // MediaPipe (web)
let faceapi = null;         // face-api.js (native)

const FACEAPI_MODEL_URL =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function loadModel() {
  if (IS_WEB) {
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js");
    const { FaceLandmarker, FilesetResolver } = window.Vision;
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });
  } else {
    faceapi = await import("face-api.js");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACEAPI_MODEL_URL),
    ]);
  }
  ready = true;
}

export async function detectLandmarks(input) {
  if (!ready) return null;

  if (IS_WEB) {
    // input = HTMLVideoElement
    const results = faceLandmarker.detectForVideo(input, performance.now());
    const lm = results?.faceLandmarks?.[0];
    if (!lm) return null;
    // Return normalized {x, y} — drowsinessDetector uses ratios so this works fine
    return lm;
  } else {
    // Native path — input = { data: Uint8Array (RGBA), width, height }
    const tf = faceapi.tf;
    const { data, width, height } = input;
    const rgbData = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgbData[j]     = data[i];
      rgbData[j + 1] = data[i + 1];
      rgbData[j + 2] = data[i + 2];
    }
    const source = tf.tensor3d(rgbData, [height, width, 3], "int32");
    const result = await faceapi
      .detectSingleFace(source, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true);
    source.dispose();
    return result?.landmarks?.positions ?? null;
  }
}
