# Physical Android API Connectivity Report

## 1. Symptom

When entering a registered mobile number on a real physical Android phone and pressing "Request OTP", the application displays:

> "Unable to connect. Check your internet connection and try again."

The failure occurs immediately at the network transport layer before the OTP request can reach the backend.

---

## 2. API Configuration

| Item | Result |
|---|---|
| **Mobile API base URL source** | `readPublicConfig()` in `src/config/config.ts` reads `process.env.EXPO_PUBLIC_HMS_API_URL` with a fallback to `http://10.0.2.2:4000/api` when environment is `development`. |
| **API URL used by preview build** | `http://10.0.2.2:4000/api` (Inlined into the standalone APK bundle during EAS cloud build because no build-time environment variable was configured in `eas.json`). |
| **localhost used** | NO |
| **10.0.2.2 used** | **YES** (Embedded in the compiled APK bundle) |
| **LAN IP configured in APK** | NO (Not present in EAS cloud build environment) |
| **SIT API configured in APK** | NO |

---

## 3. Backend

| Item | Result |
|---|---|
| **Backend port** | `4000` (Fastify API server) |
| **Bind address** | `0.0.0.0` (`HOST=0.0.0.0` in `apps/api/src/config/env.ts` — listens on all local network interfaces) |
| **OTP endpoint** | `POST /api/patient-portal/otp/request` |
| **Endpoint available** | YES (Validated via backend auth integration tests) |
| **Local backend reachable from LAN** | Requires Windows Firewall inbound permission for TCP port `4000` |

---

## 4. Network

- **Phone/PC same network required:** **YES** (Both PC and physical phone must be connected to the same Wi-Fi subnet for local testing).
- **Required API port:** `4000`
- **Firewall consideration:** Windows Defender Firewall must allow inbound TCP connections on port `4000` (or allow Node.js on Private Networks).
- **Physical-device URL:** Must be the developer PC's actual LAN IP address, e.g.: `http://<YOUR-PC-LAN-IP>:4000/api` (for example, `http://192.168.1.50:4000/api`) or a public HTTPS staging/tunnel URL.

---

## 5. Root Cause

### **The standalone APK bundle contains the Android-emulator loopback address (`http://10.0.2.2:4000/api`).**

1. In Expo/React Native, `EXPO_PUBLIC_*` environment variables are statically embedded into JavaScript code **at build time**.
2. When `npx eas build --profile preview --platform android` ran in the EAS cloud, `EXPO_PUBLIC_HMS_API_URL` was not provided in `eas.json` for the `preview` profile.
3. As a result, `readPublicConfig()` in `src/config/config.ts` fell back to its default development value: `http://10.0.2.2:4000/api`.
4. While `10.0.2.2` routes correctly inside the **Android Studio Emulator** to the host PC's `127.0.0.1`, on a **physical Android device**, `10.0.2.2` is non-routable on the phone's Wi-Fi network interface. The phone's native networking stack immediately encounters connection failure, resulting in `ApiFailure('network')` and the error message `"Unable to connect. Check your internet connection and try again."`
5. **CORS is not the cause:** Native React Native mobile requests use Android's native `OkHttp` stack rather than a browser sandbox and do not enforce browser CORS preflight restrictions.

---

## 6. Required Fix

To enable the physical Android device to reach the backend, the API base URL must be set to the developer PC's reachable LAN IP (or a staging/tunnel URL) at build time:

### Step A: Identify Developer PC's Local Network IP
Run in Windows PowerShell:
```powershell
ipconfig
```
Find the **IPv4 Address** of your active Wi-Fi adapter (e.g. `192.168.1.50`).

### Step B: Configure Build-Time Environment in `apps/patient-mobile/eas.json`
Update the `preview` profile in `eas.json` to inject `EXPO_PUBLIC_HMS_API_URL`:
```json
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_HMS_ENV": "development",
        "EXPO_PUBLIC_HMS_API_URL": "http://<YOUR-PC-LAN-IP>:4000/api"
      }
    },
    "production": {}
  }
}
```

### Step C: Ensure Windows Firewall Allows Inbound Port 4000
Ensure Windows Defender Firewall allows inbound TCP traffic on port `4000` for Private Networks so the phone can reach the PC over Wi-Fi.

---

## 7. Rebuild Requirement

- **Rebuild required:** **YES**
- **Why:** Standalone APKs (`buildType: "apk"`) are self-contained compiled binaries with the JavaScript bundle packaged inside the APK. Modifying local `.env` files on the PC does not alter the already-compiled APK installed on the phone. A new APK must be built with the correct LAN IP embedded.

---

## 8. Patient Web Protection

- **Patient Web modified:** NO
- **Patient Web diff:** CLEAN (0 modifications)

---

## 9. Final Status

### **`ROOT CAUSE IDENTIFIED — READY FOR FIX`**
