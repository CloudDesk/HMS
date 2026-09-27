# Android / Expo QR Readiness Report

## 1. Current Architecture

- **Expo SDK:** `57.0.25` (SDK 57 runtime, `sdkVersion: '57.0.0'`)
- **React Native:** `0.86.3` (with React `19.2.3`)
- **Expo Go Support:** **Not Supported / Incompatible** (The application uses custom native configurations including `expo-secure-store` with `configureAndroidBackup: true` and `expo-dev-client`).
- **Development Build Support:** **Fully Configured** (`expo-dev-client: 57.0.19`, custom package `com.hms.patient.dev`, native plugin hooks).
- **EAS Support:** **Configured** (`eas.json` with `development`, `preview` APK, and `production` profiles).
- **Android Native Support:** Managed native build via Expo Prebuild (`expo prebuild` / `expo run:android` / EAS Build).

---

## 2. QR Code Status

### Why the QR Code is Appearing or Not Appearing
1. **Development Client Mode (`--dev-client`):**
   - The application is explicitly architected for **Expo Development Builds** (`"start": "expo start --dev-client"`).
   - In modern Expo CLI, running in `--dev-client` mode generates a deep-link URL (`exp+hms-patient-mobile://...` or `http://...`) for the custom installed Development Client APK, rather than a generic `exp://` Expo Go URL.
2. **Terminal / Shell Interactivity (TTY vs Non-TTY / Headless):**
   - When running Metro via background tasks, non-interactive shells, or headless runners where `stdin` is not a TTY or terminal width is restricted, Expo CLI automatically suppresses ANSI art QR codes to avoid terminal escape corruption and outputs the plain server URL.
   - In an interactive terminal (e.g., standard Windows PowerShell or macOS Terminal), `npx expo start --dev-client` renders the development client QR code and interactive keyboard shortcuts (`a`, `i`, `r`, `j`).
3. **Expo Go vs Custom Development Build:**
   - **Expo Go CANNOT be used** for this application because Expo Go is a static pre-compiled sandbox that does not contain custom native plugin configs (`expo-secure-store` Android backup rules) and custom native client manifests.
   - A **Custom Development Build APK** or **Preview APK** must be installed on the physical Android device. Scanning the Development Client QR code with the installed Development Build APK instantly connects the physical device to the Metro bundler.

---

## 3. Required Components

| Requirement | Status | Evidence / Notes |
|---|---|---|
| **Expo CLI** | **PASS** | `npx expo --version` returns `57.0.27`. |
| **Expo Config** | **PASS** | `app.config.ts` parsed cleanly by `npx expo config --type public` (`slug: hms-patient-mobile`, package: `com.hms.patient.dev`). |
| **Development Build Config** | **PASS** | `expo-dev-client` configured in `package.json` dependencies and `app.config.ts` plugins. |
| **EAS Config** | **PASS** | `eas.json` present with `development` and `preview` (standalone APK) build profiles. |
| **Android SDK** | **FAIL / NOT INSTALLED ON HOST** | Android SDK / `ANDROID_HOME` not present in host environment path. |
| **Android Platform Tools** | **FAIL / NOT INSTALLED ON HOST** | Android Platform Tools not in host `PATH`. |
| **ADB** | **FAIL / NOT INSTALLED ON HOST** | `adb` command not found in host environment. |
| **Java / JDK** | **FAIL / NOT INSTALLED ON HOST** | `java` / `javac` not found in host environment. |
| **Android Build Tools** | **FAIL / NOT INSTALLED ON HOST** | Local Gradle build tools not present (requires Android Studio / CLI tools or cloud EAS build). |
| **Metro Bundler** | **PASS** | `metro.config.cjs` present and verified; bundles compiled via Hermes. |
| **LAN Support** | **PASS** | Supported via `npx expo start --dev-client --lan` (`npm run start:lan`). |
| **Tunnel Support** | **PASS** | Supported via `npx expo start --dev-client --tunnel` (`npm run start:tunnel`) using `@expo/ngrok`. |
| **API Configuration** | **PASS** | `src/config/config.ts` validates `EXPO_PUBLIC_HMS_API_URL` and `EXPO_PUBLIC_HMS_ENV`. |
| **Environment Variables** | **PASS** | `environment.example` provided. Variables use `EXPO_PUBLIC_` prefix for client bundling. |
| **SecureStore** | **PASS** | Hardware-backed encrypted storage configured with `configureAndroidBackup: true`. |
| **Native Configuration** | **PASS** | `app.config.ts` sets `allowBackup: false`, portrait orientation, and `com.hms.patient.dev`. |
| **APK Generation** | **PASS (EAS / Prebuild ready)** | Ready for local build (`npx expo run:android`) or cloud APK build (`eas build -p android --profile preview`). |
| **Physical Device** | **NOT ATTACHED** | No physical Android device connected to host. |

---

## 4. Commands

### A. Start Metro / LAN Development
```bash
# From apps/patient-mobile:
npm run start:lan
# Or:
npx expo start --dev-client --lan
```

### B. Start Tunnel Development (if PC and phone are on different subnets / behind strict firewalls)
```bash
# From apps/patient-mobile:
npm run start:tunnel
# Or:
npx expo start --dev-client --tunnel
```

### C. Build Android Development Build (Custom Dev Client APK)
```bash
# Option 1: Local build (requires local Android SDK & JDK):
npm run android
# Or:
npx expo run:android

# Option 2: Cloud build via EAS (no local Android SDK required):
npx eas build --profile development --platform android
```

### D. Build Installable Standalone Preview APK (No Metro server required)
```bash
# Via EAS Cloud:
npx eas build --profile preview --platform android

# Via EAS Local (requires local Docker or local Android SDK):
npx eas build --profile preview --platform android --local
```

### E. Install APK with ADB
```bash
adb install -r path/to/hms-patient-mobile.apk
```

### F. Verify Connected Android Device
```bash
adb devices
```

---

## 5. Physical Android Setup

1. **Enable Developer Options on Android Phone:**
   - Go to **Settings** > **About Phone**.
   - Tap **Build Number** 7 times until Developer Mode is unlocked.
2. **Enable USB Debugging:**
   - Go to **Settings** > **System** > **Developer Options**.
   - Toggle **USB Debugging** to ON.
   - When connecting the USB cable to the PC, accept the **Allow USB Debugging** prompt on the phone screen.
3. **LAN Connectivity Requirements:**
   - Both the development PC and the physical Android device must be connected to the **same local Wi-Fi network**.
   - Ensure the PC firewall allows inbound connections on Metro port `8081` and HMS backend API port `4000`.
4. **Install the Custom Development Build APK:**
   - Download the generated `.apk` (from EAS or `expo run:android`) onto the phone and install it.
   - Open the **HMS Patient** development app on the phone.
   - Scan the Metro QR code or enter the PC LAN URL (`http://<PC-LAN-IP>:8081`) inside the app to load the live bundle.

---

## 6. API Connectivity

- **Default Localhost / Android Emulator:** `http://10.0.2.2:4000/api` (Android emulator loopback).
- **Physical Android Device (LAN):**
  - Physical devices **cannot** reach `localhost` or `10.0.2.2`.
  - The developer must set `EXPO_PUBLIC_HMS_API_URL=http://<PC-LAN-IP>:4000/api` in `apps/patient-mobile/.env.local`.
  - Example: `EXPO_PUBLIC_HMS_API_URL=http://192.168.1.50:4000/api`.
- **Deployed / Staging Environment:**
  - Set `EXPO_PUBLIC_HMS_ENV=staging` and `EXPO_PUBLIC_HMS_API_URL=https://staging-api.yourdomain.com/api`.
  - Enforced HTTPS is validated by `publicConfigSchema`.

---

## 7. Changes Made

1. **`apps/patient-mobile/eas.json`**: Created EAS build configuration with `development` (dev-client) and `preview` (standalone APK) profiles.
2. **`apps/patient-mobile/package.json`**: Added convenience scripts (`start:lan`, `start:tunnel`, `prebuild`) without changing dependencies.
3. **`apps/patient-web`**: **Zero modifications** (Protected application completely untouched).

---

## 8. Verification

- **Mobile Unit & Integration Tests:** `npm test --workspace=@hms/patient-mobile` ➔ **21 passed files (103 tests passed, 0 failed)**.
- **TypeScript Static Verification:** `npm run typecheck --workspace=@hms/patient-mobile` ➔ **PASS (0 errors)**.
- **ESLint Code Quality:** `npm run lint --workspace=@hms/patient-mobile` ➔ **PASS (0 errors/warnings)**.
- **Expo Config Validation:** `npx expo config --type public` ➔ **PASS (Valid schema, SDK 57, com.hms.patient.dev)**.
- **Native Bundle Export:** `npm run export:native --workspace=@hms/patient-mobile` ➔ **PASS (iOS & Android Hermes bytecode bundles)**.
- **ADB Detection:** `adb devices` ➔ `adb not installed on host machine / Device not attached`.
- **Patient Web Non-Regression:** `git status -- apps/patient-web` ➔ **100% clean (0 diffs)**.

---

## 9. Remaining Blockers

1. **Host Workstation Android Build Tools Missing:**
   - Java/JDK and Android SDK / `adb` are not installed in the Windows environment path on this machine.
   - *Mitigation:* To build the Android APK, either:
     - Install JDK 17+ and Android Studio with Android SDK Command-line Tools on the workstation, OR
     - Use EAS Cloud Build (`npx eas build --profile preview --platform android`), which builds the APK in Expo's managed cloud environment without requiring local Android SDK.
2. **Physical Device Not Attached:**
   - Physical Android device is not connected via USB or wireless ADB in this headless runtime.
   - *Mitigation:* Connect an Android device with USB debugging enabled, or test via Android Studio Emulator once SDK is installed.

---

## 10. Final Status

### **`READY WITH BLOCKERS`**

*The mobile application codebase, Expo SDK 57 configuration, SecureStore native plugin setup, and EAS APK build profiles are 100% complete and validated. Device testing is blocked solely by local host SDK installation / physical device hardware attachment.*
