# D. Notification Contract — Phase 2 Proposal

No notification event or provider is marked owner-approved by this document. Proposed MVP defers inbox and push because current code has a MongoDB in-app notification foundation, not patient event delivery/device registration. This design is complete enough for a later approval decision; it creates no API, provider configuration or credential.

Push delivery is unrelated to OTP. Fixed `1234` does not require or use this infrastructure. No SMS capability is proposed.

## D1. Existing implementation and extension boundary

NotificationModel currently stores recipientRole/user/branch, title/message, type, relatedEntityId and isRead. Types are REFERRAL, CALL_NEXT_PATIENT, GENERAL, DENTAL_LAB_READY. `/api/notifications/me` and `/:id/read` resolve current recipient; role notifications have one shared read flag. There is no patient device model, Expo/FCM/APNs sender, patient event coverage or native inbox.

Propose extending the existing notification domain with **one record per patient-account recipient**, carrying approved event code, patientId, safe typed target, eventKey, occurredAt and existing read state. Reuse audit/service/repository patterns. Do not create a parallel clinical notification database. Do not send patient clinical messages to broad PATIENT/GUARDIAN roles. Individual records avoid a separate read-receipt model for this scope.

For a patient with several authorized accounts, resolve eligible self/verified guardian recipients server-side; deduplicate the same user reached through both paths. Confirm owner policy for which authorized guardians receive each event. Recheck active user/patient and grant at generation, dispatch and read/tap. Do not fan out patient records based solely on a current device's selected patient.

## D2. Provider proposal

Propose `expo-notifications` in a development build with Expo Push relay for initial cross-platform delivery, subject to infrastructure/privacy approval. Alternative: direct FCM on Android and APNs on iOS. Choose one before implementation; provider-specific tokens are not interchangeable. Expo Push still uses FCM/APNs credentials underneath; Firebase Hosting is not sufficient. Native authentication remains HMS OTP/session auth, never Firebase SMS/Auth.

Sources: [Expo push overview](https://docs.expo.dev/push-notifications/overview/), [setup](https://docs.expo.dev/push-notifications/push-notifications-setup/). No provider has been configured or selected as an approved decision.

## D3. Device registration model

One new model in the notification domain is justified because a user can have multiple installations and a token rotates independently of an auth session. It is not another account model.

| Field | Why needed |
|---|---|
| id | Server registration identifier |
| userId | Owner from authenticated session, never request body |
| installationId | Random installation identifier from native session; no hardware ID |
| platform | android/ios from native session |
| provider | EXPO, or selected FCM/APNS combination |
| token + tokenHash | Token needed for delivery, protected at rest; hash supports uniqueness and redacted lookup. Never return raw token after registration |
| appVersion | Bounded compatibility metadata |
| status | Proposed PENDING, ACTIVE, DISABLED, INVALID |
| lastSeenAt | Last authenticated registration/update; not precise user tracking |
| createdAt/updatedAt | Lifecycle |
| pendingChallengeHash/expiresAt + pending owner/token context | Short-lived token possession verification and safe reassignment; remove on completion/expiry |

No IMEI, serial, advertising ID, contacts, biometric data, location or clinical record copied into device rows. Consent/notification permission is enforced on client and reflected by disabled registration; it never affects login permission. A token alone is not an account authentication credential.

Indexes: unique active `(provider,tokenHash)` ownership, unique current `(userId,installationId,provider)` registration; conditional uniqueness/status behavior must be finalized with the selected provider. Do not TTL-delete active device rows merely because a temporary registration challenge expired; use separate challenge expiry checks/cleanup. No new background-delivery collection is automatically approved.

## D4. Register/update/unregister HTTP contract

Proposed prefix `D=/api/patient-portal/mobile/devices`. Valid active native bearer required for all calls, including current session/epoch checks. Bound platform/installation must agree with session metadata, but that agreement alone is not proof of push-token possession. Rate-limit registration/challenge delivery to prevent abuse. Responses never disclose other owners or stored token values.

| Operation | HTTP/request | Response | Rules/errors/retry |
|---|---|---|---|
| Register | `POST D` `{installationId,platform,provider,pushToken,appVersion}` | 202 `{data:{id,status:"PENDING",challengeExpiresAt}}`; existing identical active registration may return 200 ACTIVE | Server derives user. Validate supported provider/platform/token shape. Unknown/foreign token ownership is not silently overwritten |
| Verify delivery possession | `POST D/:id/confirm` `{challenge}` | 200 `{data:{id,status:"ACTIVE",lastSeenAt}}` | Nonce delivered as opaque nonclinical push to submitted token; require authenticated initiating session, unexpired hashed challenge, atomic consume. Safely disable old ownership only after proof, if reassignment is allowed |
| Update | `PATCH D/:id` `{pushToken?,appVersion?,enabled?}` | 200 active/disabled metadata; 202 PENDING if token changes | Same owner/installation; unchanged metadata update is idempotent; new token requires confirmation before patient delivery |
| Unregister | `DELETE D/:id` | 200 `{data:{ok:true}}` | Disable/remove token association; repeat for own disabled record succeeds; foreign/unknown returns 404 |

Proof challenge is not an OTP or SMS flow: it is an opaque token delivered through the chosen push channel to prevent binding someone else's device token. Deliver no patient information while PENDING. Proposed five-minute expiry; failed/denied notification delivery leaves registration pending/disabled and does not block app use. If this proof approach is not supported by selected native/provider tooling, stop and approve an alternative possession/reassignment design; do not fall back to client-supplied installation ID as proof.

Common errors: 400 `VALIDATION_ERROR`/`PUSH_PROVIDER_UNSUPPORTED`; 401 session errors; 403 `DEVICE_CONTEXT_MISMATCH`; 404 `DEVICE_NOT_FOUND`; 409 `DEVICE_REGISTRATION_CONFLICT`; 410 `DEVICE_CHALLENGE_EXPIRED`; 429 rate limited; 503 provider unavailable. These are proposed codes. Do not print provider tokens in errors.

Register/update must use a scoped idempotency key or stable upsert identity so foreground retries do not create duplicate devices/challenges. Reusing a key with changed body gives 409. Provider failure is retriable with bounded backoff; no duplicate proof spam. Repeated confirm returns active state for the same authenticated owner if already completed; stale/foreign proof cannot reassign.

On logout, disable association with that installation and account; logout-all disables that account's registrations. If several active sessions share the installation, proposed user intent is device sign-out, so token association is disabled until explicitly re-registered by an active session. For offline logout the server cannot know immediately; only generic push text is allowed, and local display/navigation is suppressed while logged out. On account switch, unregister old association when possible; new ownership requires token proof. Invalid-token provider receipts mark registration INVALID and stop delivery. Reinstall creates new installation context and re-registers; old registrations are invalidated by provider feedback/retention policy.

## D5. Patient inbox/detail/read adapter

Proposed patient-safe routes, reusing existing NotificationService/repository:

- `GET /api/patient-portal/notifications?page=1&limit=20&is_read=false`: authenticated current user only, individual recipient records, server patient-grant filter; max 100; `createdAt desc,id desc`; existing HMS list wrapper.
- `GET /api/patient-portal/notifications/:id`: current recipient + still-authorized target; returns safe message/event metadata and `{target:{kind,patientId,resourceId}}` where relevant.
- `PATCH /api/patient-portal/notifications/:id/read`: current recipient only; idempotent mark-read. Reading does not grant access to target.

New adapter prevents raw staff-role notification payloads from becoming a patient inbox accidentally. Preserve existing generic endpoints for web/staff. Do not expose removed/dependent data if its grant is revoked: filter item or return unavailable 404, with no retained clinical details. Notification unread counts use the same filter. Account-general messages may omit patientId and only open an allowlisted inbox detail.

## D6. Proposed event catalogue

Every row is **DECISION REQUIRED** until product/clinical owner approves it. “Released” is functional wording; current model evidence has verified/submitted status, not a separate release state. Implementation must use the approved gate from B.

Common payload for all remote pushes:

```json
{
  "title": "HMS update",
  "body": "Open the app to view an update.",
  "data": {
    "v": 1,
    "notificationId": "<opaque server notification ID>"
  }
}
```

No patient name/MRN, phone, diagnosis, medicine, test name/value, impression, appointment reason, amount, balance, treatment cost, bearer token or arbitrary URL. Even generic notification delivery reveals an app relationship; account opt-out must be supported. Actual target is fetched after authentication, not carried as a trusted push URL.

| Event | Trigger after commit | Recipient + authorization | Authenticated destination | Deduplication key |
|---|---|---|---|---|
| Appointment booked | Successful authoritative patient appointment creation | Active self/approved verified guardians with current patient access | Appointments -> appointment detail | booking ID + creation event + recipient |
| Appointment rescheduled | Committed reschedule including new/current appointment identity | Same patient access; suppress original reminder | Detail of replacement/current appointment, not stale original | reschedule operation ID + recipient |
| Appointment cancelled | Committed server cancellation, including staff-originated cancellation | Current patient access; no mobile cancellation API required to receive event | Cancelled appointment detail | appointment ID + transition event/version + recipient |
| Appointment reminder | Due configured reminder time for still-active future appointment | Current access/registration/opt-in at dispatch | Upcoming appointment detail | appointment ID + scheduled instant + reminder offset + recipient |
| Lab result released | Approved visibility event; current candidate VERIFIED commit | Current patient access; result still visible | Records -> lab result detail | result ID + verification/release event version + recipient |
| Imaging report released | Approved visibility event; current candidate VERIFIED commit | Same for imaging | Records -> imaging detail | report ID + verification/release event version + recipient |
| Prescription released | Approved SUBMITTED/publication event, not draft creation | Current patient access; prescription still allowed by projection | Records -> prescription detail | prescription ID + publication event/version + recipient |
| Invoice issued | Transition from draft to patient-visible invoice; not every save | Current patient access; invoice non-draft | Account -> invoice detail | invoice ID + issue event/version + recipient |
| Payment completed | Committed accepted payment record in HMS, not client success screen | Current patient/invoice ownership | Invoice detail/payment section | payment ID + committed event + recipient |
| Dental quotation update | SENT or later approved state transition; never DRAFT | Current patient access, non-draft quotation | Account -> quotation detail | quotation ID + transition event/version + recipient |
| General patient notification | Authorized staff/domain producer with explicit account/patient recipient | Sender authorized, recipient active, patient access if patient-specific | Inbox detail; optional allowlisted approved target | source command/event ID + recipient |

Each row uses the same minimal push payload and lock-screen restrictions. Reminder timing/timezone, guardians receiving billing messages, corrected-result events, expiry and opt-out categories are owner decisions, not invented defaults. Generic events cannot embed unrestricted URLs/HTML or trigger mutations from a tap.

## D7. Delivery/retry architecture

Persist event/recipient notification and durable pending delivery in the same transaction as the relevant domain transition, or use an approved transactional outbox. Reuse MongoDB/background-worker patterns; no Redis/new database. Existing NotificationModel can hold pending delivery metadata for bounded needs; a delivery-job/outbox model is justified only if scheduler/retry cardinality requires it. Review this persistence choice before implementation.

Worker claims due jobs atomically, revalidates account/grant/object visibility, deduplicates by eventKey+recipient, resolves active registrations, sends generic pushes, records provider result and retries transient failures with bounded exponential backoff. Provider delivery is at-least-once, not exactly-once; mobile deduplicates notificationId. A provider timeout must not create a second inbox record. Never mark read just because provider accepted a push.

Reminder jobs recheck appointment date/state and are invalidated by cancellation/reschedule. Corrected records need a new approved event identity, not reuse of a stale timestamp guess. Push delivery can fail or be delayed; it is not an emergency/clinical communication guarantee. The inbox is authoritative when opened.

Tap sequence: validate payload version/id -> wait for login/context -> fetch notification detail -> validate allowlisted target -> validate/switch to accessible patient with clear context -> fetch current target -> render. Revoked grant, deleted record or logged-out state shows a generic unavailable/login state. No protected GET before auth is ready; no navigation or action based solely on provider payload.

## D8. Acceptance checklist for later phase

Register/update/unregister ownership, confirmation expiry, stolen/foreign token, cross-account reassignment, duplicate token on multiple rows, token rotation, offline logout, invalid receipt, guardian revoked between event and tap, broadcast read independence, outbox transaction rollback, provider timeout duplicate, reminder reschedule/cancel, actual Android/iOS foreground/background/cold start, denied permission, generic lock-screen text, no secrets/PHI in provider payload or logs. These tests are specified, not executed in Phase 0.
