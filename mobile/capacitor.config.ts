import type { CapacitorConfig } from "@capacitor/cli";

// Gymix for iPhone and Android. The app opens the live Gymix website, so every
// website update reaches the app without a store update. The native shell adds
// what a website can't: real vibration, notifications, sticker links that open
// the app, and an offline screen.
//
// The website address is ONE setting: GYMIX_APP_URL (default below). When the
// domain changes, set it and run `npm run sync` (then rebuild for the stores).
//   GYMIX_APP_URL=https://app.gymix.com npm run sync
const APP_URL = (process.env.GYMIX_APP_URL ?? "https://gymix-seven.vercel.app").replace(/\/+$/, "");
const HOST = new URL(APP_URL).host;

const config: CapacitorConfig = {
  appId: "com.gymix.app",
  appName: "Gymix",
  webDir: "www",
  backgroundColor: "#0d1117",
  // Lets the website tell it's inside the app ("GymixApp/1" in the user agent).
  appendUserAgent: "GymixApp/1",
  server: {
    url: `${APP_URL}/start`,
    // Shown when the website can't be reached (no internet): www/offline.html.
    errorPath: "offline.html",
    // Login with Google etc. would open outside; the Gymix site stays inside.
    allowNavigation: [HOST],
  },
  ios: {
    contentInset: "never",
    // Lets the website's service worker run inside the app (offline mode).
    // The domain must also be listed in WKAppBoundDomains (ios/App/App/Info.plist).
    limitsNavigationsToAppBoundDomains: true,
    backgroundColor: "#0d1117",
  },
  android: {
    backgroundColor: "#0d1117",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#0d1117",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d1117",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
