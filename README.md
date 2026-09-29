# StayAwake — Driver Drowsiness Detection

A React Native (Expo) mobile app that uses the front camera and on-device ML to monitor driver alertness and trigger alerts when drowsiness is detected.

## How It Works

- Uses the front camera to capture live frames
- Runs **face-api.js** (TinyFaceDetector + 68-point landmark model) via TensorFlow.js CPU backend
- Computes **Eye Aspect Ratio (EAR)** from facial landmarks — the standard ML metric for drowsiness
- Triggers an alert if:
  - EAR drops below `0.21` for **more than 2 seconds** (eyes closed)
  - Blink rate drops **below 8 blinks/minute** (after 30s of data)
- Alert = loud sound + heavy vibration + full-screen warning
- Driver dismisses alert by tapping **"I'm Awake"**
- **Simulation mode** available for testing without a camera (web + native)

## Project Structure

```
StayAwake2/
├── App.js                    # Main UI, camera loop, sim mode toggle
├── src/
│   ├── mlModel.js            # face-api.js model loading + landmark detection
│   ├── drowsinessDetector.js # EAR computation + drowsiness logic
│   └── AlertService.js       # Sound + vibration alerts
├── assets/
│   └── alert.mp3             # Alert sound
├── metro.config.js           # Metro resolver fix for face-api.js CJS build
├── app.json
└── package.json
```

## ML Stack

| Component | Library |
|---|---|
| Face detection | `face-api.js` TinyFaceDetector |
| Landmark detection | `face-api.js` 68-point landmark net |
| Inference runtime | `@tensorflow/tfjs` CPU backend |
| Eye metric | Eye Aspect Ratio (EAR) from landmarks 36–47 |

## Setup

```bash
npm install
```

Model weights (~1MB) are loaded from GitHub CDN on first launch and cached automatically.

## Run

```bash
# Start Expo dev server (mobile)
npm start

# Run on web browser (simulation mode)
npx expo start --web

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Simulation Mode

The app includes a built-in simulation mode for testing without a camera:

- **Web**: simulation is ON by default
- **Native**: tap the **"📷 Live / 🧪 Sim"** toggle in the top-right corner
- Use the **Eyes Open / Eyes Closing / Eyes Closed** buttons to feed fake EAR values into the detector
- Hold **"Eyes Closed"** for 2 seconds to trigger the full alert flow

## Requirements

- **Mobile**: Expo Go app (SDK 57) on your phone, or an Android/iOS emulator
- **Web**: any modern browser (simulation mode only — camera/ML not supported on web)
- Camera permission must be granted for live detection

## Dependencies

| Package | Purpose |
|---|---|
| `expo-camera` | Front camera access |
| `face-api.js` | On-device face + landmark detection |
| `@tensorflow/tfjs` | ML inference runtime |
| `@tensorflow/tfjs-backend-cpu` | CPU backend for TF.js |
| `jpeg-js` | JPEG frame decoding |
| `expo-av` | Alert sound playback |
| `expo-haptics` | Vibration feedback |
| `react-native-web` | Web support |
