# Phase 2 scope and compatibility baseline

Read protection rules, Phase 0 REPORT/E_MOBILE_ARCHITECTURE (ARCHITECTURE.md and DECISION_PACKAGE.md are absent), Phase 1 REPORT/AUTHENTICATION_CONTRACT/GAP_NOTE and current native schemas/services. Existing Phase 1 changes are uncommitted and are preserved, not attributed to Phase 2. Protected source hashes and original lockfile saved in OS temporary directory before edits.

No backend or Patient Web source change is needed. The new request explicitly authorizes Phase 2 despite the documented unrelated Phase 1 baseline failures. Run new baseline tests/build before dependency installation; compare after installation.

Use npm apps/* workspace, root TypeScript/ESLint/Vitest conventions. Expo SDK 57.0.25's published TypeScript template specifies React 19.2.3 / React Native 0.86.3. Native modules use its bundledNativeModules.json compatibility ranges. Pin mobile versions and avoid upgrading existing web packages. Inspect lockfile for existing resolution changes. If React versions differ, mobile-only Metro resolution must keep native dependencies on mobile React; do not downgrade Patient Web React.

Minimum navigation is an auth-gated native screen switch (phone, OTP, home, recovery); no business tabs or navigation package is needed yet. RHF/Zod handles forms. Auth actions/state belong in a provider/feature hook backed by a testable session service and mobile transport. No clinical Query cache is needed in this phase.

Refresh policy: preflight known-offline means no dispatch and safe manual retry retaining secure proof. Persist an in-flight marker BEFORE dispatch. Ambiguous network/5xx/invalid response retains encrypted proof but marks it uncertain and disallows replay; fresh sign-in is required by Phase 1. A process restart with an in-flight marker has the same rule. Explicit server auth rejection clears proof. A known backend AUTH_RATE_LIMITED response occurs before rotation and permits manual retry. Do not change backend to implement replay recovery.

Secure storage contains refresh proof, its status, API binding and session expiry only. Access/profile/OTP remain memory-only. A non-secret installation marker in private app storage detects iOS keychain survival after reinstall; credentials cannot restore if marker is missing/mismatched. Logout writes a local signed-out marker and clears secure storage, even offline; late refresh/login responses cannot restore the session. Secure-storage failures fail closed with a cleanup/retry state.

Required shared edits: package-lock.json registers new workspace/dependencies; vitest.config.ts adds its project so root tests include it. Root package.json/scripts and web/backend packages remain untouched unless an evidenced tooling requirement demands otherwise. Mobile config/build/test files stay in apps/patient-mobile. No credentials or real production/staging addresses are invented.

Native prerequisites inspected: Node 22.23.1/npm 10.9.8; adb/java not on PATH, default Android SDK and Java directories absent. No iOS toolchain on Windows. Native device/development-build validation must be marked unavailable unless a usable toolchain is found; JS native exports are not device builds.
