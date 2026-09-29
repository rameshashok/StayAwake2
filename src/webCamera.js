// Web-only camera using getUserMedia
// Returns a { start, stop, getCanvas } interface

export async function requestWebCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: 320, height: 240 },
    audio: false,
  });
  videoEl.srcObject = stream;
  await new Promise((resolve) => { videoEl.onloadedmetadata = resolve; });
  await videoEl.play();
  return stream;
}

export function stopWebCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

// Draws current video frame to canvas and returns the canvas element
export function captureFrame(videoEl, canvasEl) {
  if (!videoEl || videoEl.readyState < 2) return null;
  canvasEl.width  = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  canvasEl.getContext("2d").drawImage(videoEl, 0, 0);
  return canvasEl;
}
