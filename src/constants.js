// Single place to update app-wide constants before publishing.
// Replace PRIVACY_POLICY_URL with your hosted URL (GitHub Pages, your website, etc.)
export const PRIVACY_POLICY_URL =
  "https://github.com/rameshashok/StayAwake2/blob/main/PRIVACY_POLICY.md";

export const APP_STORE_DESCRIPTION = `
StayAwake monitors your eyes in real time using your phone's front camera to help detect drowsiness while driving.

HOW IT WORKS
• Calibrates to your natural eye openness in 3 seconds
• Alerts you with sound and vibration if your eyes close for too long or your blink rate drops
• All processing happens on-device — no camera data ever leaves your phone

IMPORTANT LIMITATIONS
• Detection stops if your phone screen locks or you switch to another app
• Keep your phone mounted facing you at all times
• This app is a supplemental aid only — it does not replace attentive driving

REQUIREMENTS
• Camera permission required for live detection
• HTTPS required for camera access on mobile browsers
`.trim();
