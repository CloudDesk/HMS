# F. Prerequisite Checklist and Decision Register

**DONE** means verified documentation/source fact, not runtime certification. **PENDING** means executable work after approval. **BLOCKED** means a specific prerequisite prevents the dependent work. **DECISION REQUIRED** means the owner must choose/approve a contract. Nothing below authorizes implementation automatically.

## F1. Decision register

| ID | Proposed decision | Status | Owner / effect |
|---|---|---|---|
| D00 | Fixed `1234`, existing challenge service/limits, no external delivery or provider work | DONE — user specified | Applies to this environment; no SMS task/blocker |
| D01 | React Native + Expo development builds + TypeScript; Expo Router candidate | DECISION REQUIRED | Architecture owner approves mobile-only stack extension |
| D02 | A's existing-account/family-first MVP; complete core histories; read-only dental; no Inbox/push | DECISION REQUIRED | Product owner; moving scope rows carries dependencies |
| D03 | C native endpoints, seven-day absolute session default/15-minute access cap, mobile-only logout-all, session/epoch persistence | DECISION REQUIRED | Architecture/security owner; Phase 1 entry gate |
| D04 | Strict rotation: ambiguous response/reuse requires login; no grace/recoverable response cache | DECISION REQUIRED | Product/security owner acknowledges mobile reliability tradeoff |
| D05 | Explicit denied grant overrides legacy self fallback; current under-15 portal rule retained pending domain instruction | DECISION REQUIRED | Identity/domain owner; family feature acceptance gate |
| D06 | Non-identity profile editing only in MVP; purpose-bound phone change later; fixed code is not number-possession proof | DECISION REQUIRED | Identity/product owner; no backend bypass through generic PATCH |
| D07 | B projection and verification-as-visibility gate for lab/imaging; no separate release state invented | DECISION REQUIRED | Clinical owner; records and notification triggers blocked until approved |
| D08 | Notification Phase 2; Expo relay proposed, provider/recipient/reminder settings undecided | DECISION REQUIRED | Product/infrastructure/privacy owners; no push prerequisite for proposed MVP |
| D09 | B file availability, upload ambiguity/deduplication and approved durable storage/privacy handling | DECISION REQUIRED | API/storage owner; document feature acceptance gate |
| D10 | Store release/deletion/retention/support policy, distribution target and data classification | DECISION REQUIRED | Release/product owner; fixed environment contract is not a public identity-assurance claim |
| D11 | Only G Phase 1 next; no mobile project or history/push implementation in it | DECISION REQUIRED | Explicit phase approval after reviewing concrete C/G |

A single approval should identify decision IDs accepted and any amendments. This document does not mark scope/clinical rules approved on behalf of the owner.

## F2. Repository and backend checklist

| Item | Status | Evidence / next action |
|---|---|---|
| Read prior readiness baseline | DONE | Preserved; SMS recommendation superseded by D00 |
| Current source/workspace/config/CI inspection | DONE | REPORT evidence at HEAD e9c93b2; source findings revalidated |
| Fixed OTP branch and local configuration identified | DONE | Existing demo flag/code `1234`; no sender in that branch |
| Verify target running environment uses fixed configuration | PENDING | Runtime process/deployment setting not established by source inspection; no external sender calls during validation |
| Existing web cookie behavior documented | DONE | C2; unchanged in Phase 0 |
| Native endpoints/session lifecycle available | BLOCKED | Not implemented; D03/D04/D11 approval then G |
| MongoDB strict transaction capability | PENDING | Verify isolated replica-set tests and target topology; no silent standalone fallback for native sessions |
| Model/index decisions | DECISION REQUIRED | Session anchor, token fields, user epoch in C; no migration now |
| Guardian/self precedence | DECISION REQUIRED | D05; current fallback explained |
| Safe profile and login-phone semantics | DECISION REQUIRED | D06; existing generic update unsafe for identity change |
| Complete-history contracts drafted | DONE | B3; implementation depends on scope/clinical sign-off |
| Clinical exposure approval | BLOCKED | D07; notes/diagnosis not automatically patient-visible |
| File ownership/download reuse identified | DONE | Existing portal service; native private handling pending |
| Document durability, bounded listing, MIME/content testing | PENDING | Existing local buffered storage and all-files list need acceptance |
| Patient push/device service available | BLOCKED for Phase 2 only | D08 then D implementation; not MVP login blocker |
| Existing automated baseline failures | PENDING | Prior run: 100 pass, 3 catalogue test failures; not rerun in Phase 0 |
| API/web/patient-web regression checks | PENDING | G requires checks; no code build/test claim for this documentation phase |
| Shared frontend contract package | DECISION REQUIRED if needed | None exists; do not add workspace package during Phase 1 auth work |

## F3. Mobile checklist

| Item | Status | Completion evidence required |
|---|---|---|
| Proposed scope/layers/navigation | DONE as proposal | A/E ready for review |
| Technology selected as approved | DECISION REQUIRED | D01 |
| Native auth/storage/file/security contracts | DONE as proposal | C/B/E |
| SDK/dependency versions | PENDING | Select compatible release matrix only when native project phase authorized |
| Android/iOS development tool availability | PENDING | No local SDK/Xcode/cloud entitlement inventory performed |
| Native project creation | BLOCKED | Explicitly prohibited in Phase 0 and proposed Phase 1 |
| Real-device test matrix | PENDING | Login, expiry, two devices, logout, reinstall, network loss, background/resume, files/permission denial |
| Biometrics/camera/scanning/offline clinical cache | DECISION REQUIRED for later scope | No implementation in MVP proposal |

## F4. Android release checklist

| Requirement | Status | Concrete owner action |
|---|---|---|
| Application ID | DECISION REQUIRED | Reserve owner-approved stable ID; no ID invented in documents |
| SDK/JDK/build toolchain | PENDING | Pin against selected Expo/RN release and actual store target SDK at release time |
| Signing/upload key | PENDING | Establish custody, CI secret access and recovery; do not commit keys |
| Play Console/developer verification | PENDING | Verify organization/account access and requirements; not inferred from Firebase |
| Signed release AAB | PENDING | Build/version/validate native release in authorized later phase |
| Internal test track/device acceptance | PENDING | Fresh/reinstall/update, offline/logout, large fonts, private documents |
| Firebase/FCM | DECISION REQUIRED / conditional Phase 2 | Required only if selected push design includes it; no Firebase changes now |
| Notification channel/permission | PENDING if push selected | Real-device opt-in/denial behavior |
| App Links | PENDING if external links selected | Owned domain, assetlinks association, signing certificate fingerprints, verification |

## F5. iOS release checklist

| Requirement | Status | Concrete owner action |
|---|---|---|
| Bundle ID | DECISION REQUIRED | Reserve owner-approved stable ID |
| Apple Developer/App Store Connect | PENDING | Verify organization, roles and paid capability/access as needed |
| macOS/Xcode or cloud build route | DECISION REQUIRED | Local iOS builds need macOS; cloud credentials/device testing still required |
| Certificates/provisioning/signing | PENDING | Custody, team access and CI credentials; nothing configured |
| Physical device/TestFlight | PENDING | Signed build, testers, privacy descriptions and native acceptance |
| APNs entitlement/key | PENDING if push selected | Configure only in approved push phase |
| Universal Links | PENDING if external links selected | Owned domain, association file, associated-domains entitlement |
| Privacy/permission declarations | PENDING | Only actual used capabilities; no unused camera/biometric permissions |

## F6. Both platforms / release

| Requirement | Status | Required completion |
|---|---|---|
| API URL/TLS/environment separation | PENDING | Reachable staging HTTPS; build exposes only public config, no server secrets |
| Privacy policy | DECISION REQUIRED | Accurate health/account/file/push handling and sharing disclosure |
| Health-data disclosure | PENDING | Actual data flows and SDK audit; Google health declaration and store privacy forms |
| Support URL/contact | DECISION REQUIRED | Owner-controlled working page and support workflow |
| Account deletion | DECISION REQUIRED | In-app initiation/support path and web path where required; no portal route currently verified |
| Retention | DECISION REQUIRED | Separate portal account removal from retained medical/audit records; legal/domain owner decision |
| Version/build numbering | PENDING | Monotonic store build IDs, release notes, environment association |
| Minimum supported app version | DECISION REQUIRED | Backend compatibility policy and maintenance/upgrade UX; no minimum-version endpoint currently proposed as implemented |
| API backward compatibility | PENDING | Support release overlap; additive resource contracts; no silent web-breaking response changes |
| Crash monitoring | DECISION REQUIRED | Vendor/redaction/retention/region; no clinical snapshots or session replay by default |
| CI/CD | PENDING | Native checks/signing only in later native phase; existing API lint currently nonblocking |
| Rollback | PENDING | Server compatibility/feature rollback, staged rollout, emergency build process; app stores cannot instantly downgrade installed apps |
| File storage/backup | PENDING | Approved durable storage and access policy; no cached clinical files in general device backups |
| Release sign-off | BLOCKED | D10 and accepted feature/security/device evidence |

Store requirements must be checked for the chosen distribution and release date. Apple documents in-app account-deletion initiation where account creation is supported; Google documents account-deletion paths and health declarations. These are release checklist inputs, not a decision to erase legally retained health records. Sources: [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [Google health declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en).

## F7. Phase 0 completion boundary

DONE: seven proposed deliverables and repository revalidation. DECISION REQUIRED: owner scope/contract sign-off. PENDING: implementation and runtime verification. Phase 1 remains BLOCKED on explicit approval, exactly as requested. No SMS/provider setup is included in any prerequisite category.
