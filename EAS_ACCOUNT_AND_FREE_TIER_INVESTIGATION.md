# EAS Account & Free Tier Queue Investigation
**Investigation Date:** 2026-09-29  
**Status:** Complete (Read-Only Investigation — No Account or Project Changes Made)

---

## 1. Current Project Configuration

- **Workspace:** `@hms/patient-mobile`
- **Project Directory:** `apps/patient-mobile`
- **Expo SDK:** `57.0.25` (Expo SDK 57)
- **React Native:** `0.86.3`
- **App Name:** `MyCare`
- **Expo Slug:** `hms-patient-mobile`
- **Configured Owner in `app.config.ts`:** `hmsapps`
- **EAS Full Project Name:** `@hmsapps/hms-patient-mobile`
- **EAS Project ID (`extra.eas.projectId`):** `07adcdc9-76ef-4b20-a4e7-2392688a4e2c`
- **Android Package Name:** `com.hms.patient.dev`
- **iOS Bundle Identifier:** `com.hms.patient.dev`
- **Active Build Profile:** `preview` (`distribution: "internal"`, `android.buildType: "apk"`)
- **Backend API URL (`EXPO_PUBLIC_HMS_API_URL`):** `https://hms-api-atok.onrender.com/api`

---

## 2. Current Expo Account

- **Authenticated Username:** `hmsapps`
- **Associated Email:** `infiniteholding508@gmail.com`
- **Account Role:** `Owner`
- **Organizations / Accounts Accessible:**
  - `hmsapps` (Role: Owner)
  - `hmsappss-team` (Role: Owner)

---

## 3. Current EAS Project

- **Project Full Name:** `@hmsapps/hms-patient-mobile`
- **Project ID:** `07adcdc9-76ef-4b20-a4e7-2392688a4e2c`
- **Configured Plugins:**
  - `['expo-secure-store', { configureAndroidBackup: true }]`
  - `'expo-dev-client'`

---

## 4. Current Build Status

- **Active Build ID:** `05dae6b4-3fe1-445d-a196-efa24c7ecf69`
- **Platform:** Android
- **Status:** `in queue`
- **Profile:** `preview` (APK generation)
- **Started At:** 29/09/2026, 10:22:21 PM IST
- **Triggered By:** `hmsapps`
- **Build URL:** `https://expo.dev/accounts/hmsapps/projects/hms-patient-mobile/builds/05dae6b4-3fe1-445d-a196-efa24c7ecf69`
- **Previous Completed Builds for Project:**
  - `79404e8c-4a2d-46e1-b806-5234767d8dbd` (Finished in ~13 min at 5:58 PM)
  - `eedc73fb-0915-43db-99a5-b5dc841a846a` (Finished in ~12 min at 5:49 PM)

---

## 5. Free Tier Queue Analysis

### How the EAS Free Tier Queue Works:
1. **Global Shared Worker Pool:**
   All Free Tier Expo accounts globally share a finite pool of cloud build servers hosted by Expo.
2. **Priority Ordering:**
   Paid EAS plans (Production / Enterprise plans with priority concurrency) bypass the free queue and execute immediately. Free tier jobs are scheduled into available slots on a best-effort basis.
3. **Queue Congestion Windows:**
   During peak global development windows, the free tier queue wait time can fluctuate between 15 minutes and 1+ hour depending on global queue depth.
4. **Account vs. Global Queue:**
   The delay is **not account-specific or project-specific**; it is caused by high global demand on the shared Expo Free Tier builder infrastructure.

> [!NOTE]
> **Key Finding on Switching to Another Free Account:**  
> If the second account is also on the Free Tier, switching accounts will **not avoid the queue**. The new build request will simply enter the exact same global Free Tier queue at the back of the line.

---

## 6. Current Credentials Status

- **Android Keystore:** Managed by EAS under project `@hmsapps/hms-patient-mobile`.
- **Credential Scope:** Project-scoped and tied to `@hmsapps/hms-patient-mobile` on EAS servers.
- **Signing Consistency:** Both previous successful builds (`79404e8c...` and `eedc...`) used this EAS-managed Keystore to sign the preview APK for `com.hms.patient.dev`.

---

## 7. Another Account Feasibility

### Scenario A: Switching to Another Free-Tier Expo Account
- **Technical Feasibility:** Possible, but requires creating a new EAS project (or transferring ownership) and generating a new `projectId`.
- **Queue Impact:** **No benefit.** Enters the same shared Free Tier queue.
- **Risks:** Generates a new Android Keystore, causing signature mismatch errors on existing devices, and resets build history.

### Scenario B: Adding a Secondary Account as a Member/Collaborator
- **Technical Feasibility:** Feasible via Expo dashboard under Organization / Project Settings $\rightarrow$ Members.
- **Queue Impact:** **No benefit.** The build still runs under the `hmsapps` project plan.

### Scenario C: Switching / Transferring to an Account with a Paid EAS Plan
- **Technical Feasibility:** Feasible. Transferring the existing project (`@hmsapps/hms-patient-mobile`) to a paid organization retains the exact same `projectId` (`07adcdc9-76ef-4b20-a4e7-2392688a4e2c`) and Keystore credentials.
- **Queue Impact:** **Immediate priority execution** (bypasses the Free Tier queue).

---

## 8. Project Ownership Implications

| Attribute | Current (`hmsapps`) | If Recreated on New Account | If Transferred to Paid Org |
|---|---|---|---|
| **EAS Project ID** | `07adcdc9-76ef-4b20-a4e7-2392688a4e2c` | **New UUID** (Must edit `app.config.ts`) | **Preserved** (Unchanged) |
| **Project Full Name** | `@hmsapps/hms-patient-mobile` | `@<new-owner>/hms-patient-mobile` | `@<new-owner>/hms-patient-mobile` |
| **Android Keystore** | Existing EAS Keystore | **New Keystore** (Signature mismatch) | **Preserved** (Existing Keystore retained) |
| **Build History** | Preserved | Lost / Starts at Build #1 | Preserved |
| **Expo Updates / OTA** | Tied to current `projectId` | Broken unless reconfigured | Preserved |

---

## 9. Credential Implications

- **Android Signing Keystore:**
  Android requires APK updates for the same package (`com.hms.patient.dev`) to be signed by the **exact same private key**.
- If a new EAS project is created under another account without exporting/importing the existing keystore, the new build will produce an APK with a **different signature**, resulting in:
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE` on any physical device that already has the app installed.
- **Mitigation if switching accounts:** The keystore must be explicitly exported using `eas credentials` and re-imported into the new project, or the project must be transferred directly rather than recreated.

---

## 10. Android Package Identity Implications

- **Package ID:** `com.hms.patient.dev`
- **Application ID:** Independent of Expo account name.
- **Google Play / App Store:** Stores identify apps by Package Name / Bundle ID and signing key, not by Expo username.
- **Device Upgradability:** Depends strictly on the **Signing Keystore + Package Name**.

---

## 11. Local Build Environment

*Host machine readiness check:*

| Requirement | Status | Current Value | Local Build Feasible? |
|---|:---:|---|:---:|
| **Node.js & npm** | ✅ Available | Node.js v22.x / npm 10.x | Yes |
| **Java JDK (JDK 17+)** | ❌ Missing | Not found in PATH | No |
| **Android SDK Platform** | ❌ Missing | `ANDROID_HOME` / `ANDROID_SDK_ROOT` not set | No |
| **Android Build Tools** | ❌ Missing | Not found in PATH | No |
| **Android Debug Bridge (`adb`)** | ❌ Missing | Not found in PATH | No |
| **Gradle** | ❌ Missing | Not found in PATH | No |

**Conclusion on Local Build:**  
Local APK compilation (`npx eas build --local` or `cd android && ./gradlew assembleRelease`) cannot execute immediately on this machine without installing JDK 17, Android Command Line Tools, Android SDK Platform 35, and Build Tools (~3–5 GB installation).

---

## 12. Option Comparison

| Option | Queue Impact | Project Changes Required | Credential Impact | Risk & Practical Considerations |
|---|---|---|---|---|
| **Option A: Wait for Current Build** | ⏳ Will build as soon as free worker is allocated (~15–45 min remaining). | **None** (0 changes). | **Zero risk.** Preserves Keystore, `projectId`, and package identity. | Lowest risk; guaranteed compatibility with physical test devices. |
| **Option B: Another Free Account** | ❌ **No benefit.** Enters the exact same global Free Tier queue. | Requires new `projectId` or transfer. | Requires keystore migration to avoid `UPDATE_INCOMPATIBLE`. | High effort with 0 queue improvement. |
| **Option C: Transfer to Paid EAS Account** | ⚡ **Instant build.** Priority concurrency slot allocated immediately. | Only transfer ownership in Expo dashboard. | **Zero risk.** Keystore and `projectId` preserved. | Requires an active paid Expo subscription ($29+/mo). |
| **Option D: Local Android Build** | ⚡ **Instant build on host CPU.** | None to app source code. | Requires generating/managing local `debug.keystore`. | Requires downloading and configuring ~4GB of Android SDK + Java JDK on Windows. |

---

## 13. Recommended Next Steps

1. **Recommended Course of Action:**
   - **Keep the current build (`05dae6b4-3fe1-445d-a196-efa24c7ecf69`) in queue.**
   - It was queued at 10:22 PM and will automatically execute as soon as the next free build runner becomes available.
   - Creating another free account will reset your queue position to the very back of the line without any speed advantage.
2. **If immediate priority builds are mandatory in the future:**
   - Upgrade the `hmsapps` account to an EAS On-Demand / Production plan, OR
   - Set up the local Android SDK + Java JDK 17 on the host environment for offline builds using `npx eas build --local`.
