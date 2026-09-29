# StayAwake — Driver Drowsiness Detection

A React Native (Expo) mobile app that uses the front camera and on-device ML to monitor driver alertness and trigger alerts when drowsiness is detected.

## How It Works

- Uses the front camera to capture live frames
- **Web**: runs **MediaPipe FaceLandmarker** (478-point landmarks, WASM) loaded from CDN
- **Native**: runs **face-api.js** (TinyFaceDetector + 68-point landmarks) via TensorFlow.js CPU backend
- Performs a **3-second calibration** on launch to compute a personal EAR baseline (keep eyes open)
- Computes **Eye Aspect Ratio (EAR)** from facial landmarks — the standard metric for drowsiness
- Triggers an alert if:
  - EAR drops below **85% of calibrated baseline** for **more than 2 seconds** (eyes closed)
  - Blink rate drops **below 8 blinks/minute** (after 30s of data)
- Alert = loud sound + heavy vibration + full-screen warning
- Driver dismisses alert by tapping **"I'm Awake"**
- **Simulation mode** available for testing without a camera

## Project Structure

```
StayAwake2/
├── App.js                    # Main UI, camera loop, sim mode toggle
├── src/
│   ├── mlModel.js            # MediaPipe (web) + face-api.js (native) model loading
│   ├── drowsinessDetector.js # EAR computation, adaptive calibration, drowsiness logic
│   ├── AlertService.js       # Sound + vibration alerts
│   └── webCamera.js          # getUserMedia helper for web
├── assets/
│   └── alert.mp3             # Alert sound
├── metro.config.js           # Metro resolver fix for face-api.js CJS build (native)
├── app.json
└── package.json
```

## ML Stack

| Platform | Component | Library |
|---|---|---|
| Web | Face + landmark detection | MediaPipe FaceLandmarker (478 pts, WASM) |
| Native | Face detection | `face-api.js` TinyFaceDetector |
| Native | Landmark detection | `face-api.js` 68-point landmark net |
| Native | Inference runtime | `@tensorflow/tfjs` CPU backend |
| Both | Eye metric | Eye Aspect Ratio (EAR) |

## Setup

```bash
npm install
```

- **Web**: MediaPipe model (~4MB) is downloaded from Google CDN on first launch and cached by the browser
- **Native**: face-api.js weights (~1MB) are loaded from GitHub CDN on first launch

## Run

```bash
# Start Expo dev server (mobile)
npm start

# Run on web browser
npx expo start --web

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Web Camera on Mobile (iOS Safari / Chrome)

Camera access requires **HTTPS**. Use Expo's tunnel mode to get a public HTTPS URL:

```bash
npx expo start --web --tunnel
```

Then open the tunnel URL on your mobile browser.

## Simulation Mode

- Tap the **"📷 Live / 🧪 Sim"** toggle in the top-right corner
- Use the **Eyes Open / Eyes Closing / Eyes Closed** buttons to feed fake EAR values into the detector
- Hold **"Eyes Closed"** for 2 seconds to trigger the full alert flow

## Requirements

- **Mobile**: Expo Go app (SDK 57) on your phone, or an Android/iOS emulator
- **Web**: any modern browser with camera support
- Camera permission must be granted for live detection
- HTTPS required for camera access on mobile browsers

## Dependencies

| Package | Purpose |
|---|---|
| `expo-camera` | Front camera access (native) |
| `face-api.js` | On-device face + landmark detection (native) |
| `jpeg-js` | JPEG frame decoding (native) |
| `expo-av` | Alert sound playback |
| `expo-haptics` | Vibration feedback |
| `react-native-web` | Web support |
