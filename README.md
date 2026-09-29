# StayAwake — Driver Drowsiness Detection

A React Native (Expo) mobile app that uses the front camera and face detection to monitor driver alertness and trigger alerts when drowsiness is detected.

## How It Works

- Uses the front camera to continuously detect the driver's face
- Tracks **eye open probability** via `expo-face-detector`
- Triggers an alert if:
  - Eyes are closed for **more than 2 seconds**
  - Blink rate drops **below 8 blinks/minute** (after 30s of data)
- Alert = loud sound + heavy vibration + full-screen warning
- Driver dismisses alert by tapping **"I'm Awake"**

## Project Structure

```
StayAwake2/
├── App.js                    # Main UI + camera + face detection
├── src/
│   ├── drowsinessDetector.js # Eye tracking & drowsiness logic
│   └── AlertService.js       # Sound + vibration alerts
├── assets/
│   └── alert.mp3             # Alert sound (add your own)
├── app.json
└── package.json
```

## Setup

```bash
npm install
```

> Add an `alert.mp3` file to the `assets/` folder (any short alarm sound).

## Run

```bash
# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Requirements

- Expo Go app on your phone, or an Android/iOS emulator
- Physical device recommended for accurate face detection
- Camera permission must be granted

## Dependencies

| Package | Purpose |
|---|---|
| `expo-camera` | Front camera access |
| `expo-face-detector` | Eye open probability detection |
| `expo-av` | Alert sound playback |
| `expo-haptics` | Vibration feedback |
