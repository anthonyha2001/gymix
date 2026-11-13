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

## Push notifications, rest timer, scanner and widget (added 13 Nov 2026)

- **Web push (installed web app)** works with no setup: keys are made on first use and kept in the database.
  The database calls `/api/push/dispatch` through `pg_net`; enable the **pg_net** extension in Supabase
  (Database → Extensions) if the migration couldn't.
- **Android push:** create a Firebase project, add the Android app `com.gymix.app`, put `google-services.json`
  in `android/app/`, and set `FIREBASE_SERVICE_ACCOUNT` (the service account JSON, one line) in Vercel.
  The app only asks for push once that variable is set.
- **iPhone push:** in the Apple account create an APNs key, then set `APNS_KEY` (the .p8 contents),
  `APNS_KEY_ID`, `APPLE_TEAM_ID` (and `APNS_PRODUCTION=1` for the App Store build) in Vercel.
- **Sound:** set `GYMIX_PUSH_SOUND` to the file name once chosen (Android `res/raw/<name>`, iOS `<name>.caf`).
- **Rest timer** uses `@capacitor/local-notifications` (lock screen), **scanning** uses `@capacitor-mlkit/barcode-scanning`.
  Run `npm install` and `npx cap sync` after pulling.
- **Home-screen widget**
  - Android: built in (`GymixWidget.java`, `WidgetPlugin.java`), nothing to do.
  - iPhone, once in Xcode: File → New → Target → Widget Extension named `GymixWidget` (no Live Activity,
    no configuration intent). Replace its Swift file with `ios/GymixWidget/GymixWidget.swift`, then add the
    App Group `group.com.gymix.app` to both the App and GymixWidget targets (Signing & Capabilities).

## Writing NFC stickers in the app (added 13 Nov 2026)

Staff write check-in, door and machine stickers straight from Gymix, on iPhone and Android, with no other app.
The website (`web/src/lib/nfc.ts`) calls the `GymixNfc` plugin when it runs in the app, and falls back to Web NFC in
Chrome on Android. Safari can't write NFC, so on iPhone the page asks to open it in the app.

- **Android**: `NfcPlugin.java` (reader mode, writes or formats the tag), registered in `MainActivity`; the
  `android.permission.NFC` permission is in the manifest.
- **iPhone** (7 and newer): `GymixNfcPlugin` in `SceneDelegate.swift` (Core NFC), `NFCReaderUsageDescription` in
  `Info.plist`, and the `com.apple.developer.nfc.readersession.formats` entitlement (`TAG`). In the Apple Developer
  portal, tick **NFC Tag Reading** on the App ID `com.gymix.app`, then regenerate the provisioning profile; in Xcode,
  Signing & Capabilities should then show "Near Field Communication Tag Reading".
- Needs a new app build (store update): older builds don't have the plugin and behave like a browser.
