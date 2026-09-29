import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import * as faceapi from "face-api.js";

let ready = false;

// face-api.js needs a fetch-compatible env — Expo provides one.
// Model weights are loaded from a CDN URL (small ~1MB files).
const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

export async function loadModel() {
  await tf.setBackend("cpu");
  await tf.ready();
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  ready = true;
}

// imageData: { data: Uint8Array (RGBA), width, height }
export async function detectLandmarks(imageData) {
  if (!ready) return null;
  const { data, width, height } = imageData;

  // Build a tensor3d [H, W, 3] RGB from RGBA bytes
  const rgbData = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgbData[j]     = data[i];
    rgbData[j + 1] = data[i + 1];
    rgbData[j + 2] = data[i + 2];
  }

  const tensor = tf.tensor3d(rgbData, [height, width, 3], "int32");

  const result = await faceapi
    .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true); // true = use tiny 68-point net

  tensor.dispose();
  return result?.landmarks?.positions ?? null; // array of 68 {x, y} points
}
