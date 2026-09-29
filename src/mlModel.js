import * as faceapi from "face-api.js";

let ready = false;

const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

export async function loadModel() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  ready = true;
}

// On web: pass an HTMLVideoElement — face-api.js handles it natively
// On native: pass { data: Uint8Array (RGBA), width, height }
export async function detectLandmarks(input) {
  if (!ready) return null;

  let source;
  let isTensor = false;

  if (typeof HTMLVideoElement !== "undefined" && input instanceof HTMLVideoElement) {
    source = input;
  } else {
    // Native path — convert RGBA bytes to RGB tensor using face-api's bundled tf
    const tf = faceapi.tf;
    const { data, width, height } = input;
    const rgbData = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgbData[j]     = data[i];
      rgbData[j + 1] = data[i + 1];
      rgbData[j + 2] = data[i + 2];
    }
    source = tf.tensor3d(rgbData, [height, width, 3], "int32");
    isTensor = true;
  }

  const result = await faceapi
    .detectSingleFace(source, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true);

  if (isTensor) source.dispose();

  return result?.landmarks?.positions ?? null;
}
