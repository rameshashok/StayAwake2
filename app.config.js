module.exports = ({ config }) => ({
  ...config,
  name: "StayAwake",
  slug: "stayawake",
  version: "1.0.0",
  runtimeVersion: { policy: "appVersion" },
  sdkVersion: "57.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1a1a2e",
  },
  ios: {
    bundleIdentifier: "com.stayawake.app",
    buildNumber: "1",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: "Camera is used to monitor driver's eyes for drowsiness detection.",
      NSMicrophoneUsageDescription: "Microphone access is required by the camera.",
      UIRequiresPersistentWiFi: false,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1a1a2e",
    },
    permissions: ["CAMERA", "VIBRATE", "WAKE_LOCK"],
    package: "com.stayawake.app",
    versionCode: 1,
  },
  plugins: [
    ["expo-camera", {
      cameraPermission: "Camera is used to detect driver drowsiness.",
      microphonePermission: false,
    }],
    "@sentry/react-native",
  ],
  extra: {
    sentryDsn: process.env.SENTRY_DSN ?? null,
    eas: { projectId: "49af6747-06ed-4adc-9b84-46d73fd2921b" },
  },
  owner: "rameshashok",
});
