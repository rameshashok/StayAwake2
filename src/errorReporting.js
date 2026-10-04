import * as Sentry from "@sentry/react-native";

const DSN = process.env.SENTRY_DSN || "";

export function initErrorReporting() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? "development" : "production",
    enabled: !__DEV__,
  });
}

export function captureError(error, context = {}) {
  if (!DSN) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(error);
  });
}

export function captureMessage(message, level = "info") {
  if (!DSN) return;
  Sentry.captureMessage(message, level);
}

export const wrap = Sentry.wrap;
