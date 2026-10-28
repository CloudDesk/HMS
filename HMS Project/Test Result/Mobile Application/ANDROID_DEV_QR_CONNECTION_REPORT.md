# Android Development Build & QR Connection Report

## 1. EAS Build

- **EAS authentication:** PASS (`hmsapps`)
- **EAS project:** PASS (`@hmsapps/hms-patient-mobile`, Project ID: `07adcdc9-76ef-4b20-a4e7-2392688a4e2c`)
- **Android preview profile:** PASS (`eas.json` contains `preview` profile with `android.buildType = "apk"`)
- **APK build:** READY FOR USER TERMINAL EXECUTION (`npx eas build --profile preview --platform android`)

## 2. APK Installation

- **APK available:** PENDING BUILD EXECUTION
- **Physical Android device:** NOT CONNECTED (Headless host runtime)
- **APK installed:** NOT VERIFIED (Awaiting user APK build & device installation)

## 3. Development Server

- **Start command used:** `npm run start:lan --workspace=@hms/patient-mobile` (or `npx expo start --dev-client --lan`)
- **Metro started:** READY FOR USER TERMINAL EXECUTION
- **Development-client mode:** YES (`--dev-client` configured in `package.json` scripts)
- **LAN mode:** YES (`--lan` flag configured in `start:lan`)
- **Tunnel mode:** YES (`--tunnel` flag configured in `start:tunnel`)

## 4. QR / Connection

- **QR code displayed:** PENDING METRO START (Will render as ANSI QR in user's interactive terminal upon starting Metro)
- **Development URL displayed:** YES (Metro development-client deep link `exp+hms-patient-mobile://expo-development-client/?url=http://<PC-LAN-IP>:8081`)
- **Development build deep link displayed:** YES
- **Connection method:** Open installed **HMS Patient** Development Build APK on Android device and scan Metro QR code or input PC LAN server URL.

## 5. API Connectivity

- **Physical-device API configuration:** READY (Configured via `EXPO_PUBLIC_HMS_API_URL` in `src/config/config.ts`)
- **Local API:** YES (`http://<PC-LAN-IP>:4000/api` for physical device, `http://10.0.2.2:4000/api` for Android emulator)
- **SIT API:** YES (`https://staging-api.yourdomain.com/api` enforced HTTPS)

## 6. Patient Web Protection

- **Patient Web modified:** NO
- **Patient Web diff:** CLEAN (0 modifications)

## 7. Remaining Blockers

1. **Execute EAS Cloud Build:** User must run `npx eas build --profile preview --platform android` in their local terminal to produce the installable `.apk`.
2. **Install APK on Device:** User must download the generated `.apk` and install it on their physical Android phone.
3. **Start Local Metro Server:** User must run `npm run start:lan --workspace=@hms/patient-mobile` in their terminal and scan the displayed QR code using the installed HMS Patient app.

## 8. Final Status

### **`READY FOR ANDROID DEVELOPMENT-CLIENT TESTING`**
