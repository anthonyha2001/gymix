# Gymix for iPhone and Android

A native shell (Capacitor 8) around the live Gymix website. Every website
deploy reaches the app at once; only native changes need a store update.

- App ID: `com.gymix.app` (can never change after the first release)
- Website: one setting, `GYMIX_APP_URL` (default `https://gymix-seven.vercel.app`)

## Everyday commands (in this folder)

| Command | What it does |
|---|---|
| `npm install` | Installs Capacitor (first time) |
| `npm run sync` | Writes the website address into every file, copies web files, updates plugins |
| `npm run android` | Opens the project in Android Studio (Run ▶ installs it on a phone or emulator) |
| `npm run ios` | Opens the project in Xcode (Mac only) |
| `npm run assets` | Redraws the icon and splash screen from the Gymix mark, in every size |

Changing the domain: `GYMIX_APP_URL=https://app.example.com npm run sync`, then rebuild.
Once the app is in the stores, a new domain means a store update, so set the final one first.

## What the native shell adds

- Real vibration (iPhone too) through `@capacitor/haptics`; the website's `lib/haptics.ts` uses it.
- Gymix links (door stickers `/d/`, check-in `/c/`, invites `/join/`, machines `/m/`, programs `/p/`)
  open the app. Android: intent filter with `autoVerify`; iOS: Associated Domains. The website proves
  ownership at `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`.
- Motion permission (shake gesture) granted once for the Gymix site (`GymixViewController` in
  `ios/App/App/SceneDelegate.swift`), camera for the QR scanner.
- Android back button: closes a dialog, goes back, or leaves the app from the first page.
- An offline screen (`www-src/offline.html`) that reconnects by itself.
- Push notifications: plugin installed; switched on with Firebase (see below).

## Test on an Android phone now (free, no store account)

1. Install Android Studio (it brings Java and the Android SDK).
2. `npm run sync`, then `npm run android`.
3. Plug in an Android phone with USB debugging on (Settings → About → tap Build number 7 times →
   Developer options → USB debugging), choose it at the top and press Run ▶.

iPhone testing needs a Mac (or a cloud Mac) and the Apple Developer account.

## Launch day checklist

1. **Final domain**: `GYMIX_APP_URL=https://… npm run sync`.
2. **Google Play** ($25 once): create the app `com.gymix.app`; in Play Console → App integrity, copy the
   SHA-256 fingerprint(s) into Vercel as `ANDROID_CERT_SHA256` and redeploy the website.
3. **Apple** ($99/year): register the App ID `com.gymix.app` with Associated Domains and Push
   Notifications; put the Team ID in Vercel as `APPLE_TEAM_ID` and redeploy; in
   `ios/App/App/App.entitlements` set `aps-environment` to `production`.
4. **Firebase** (free): add the Android app (`google-services.json` → `android/app/`) and the iOS app
   (APNs key upload) for push notifications.
5. Version: bump `versionCode`/`versionName` (android/app/build.gradle) and `MARKETING_VERSION` /
   `CURRENT_PROJECT_VERSION` (Xcode) for every store upload.
6. Store pages: privacy policy URL, data safety form, screenshots, and the in-app "Delete my account".
