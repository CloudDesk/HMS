# Phase 9 — Notifications & Push Capability Audit

## 1. Executive Summary

This audit evaluates the notification infrastructure and capabilities across the HMS backend, Patient Web, and Patient Mobile application (`@hms/patient-mobile`).

Per Phase 9 Instructions (Sections 5, 18, and 41):
- Existing notification endpoints (`GET /api/notifications/me` and `PATCH /api/notifications/:id/read`) are fully audited and integrated into the native Notification Center.
- Push notification infrastructure (FCM, APNs, Expo Push) is **NOT** present in the current HMS backend contract and is documented as a capability gap.

---

## 2. Notification Capability Audit Matrix

| Capability | Backend Support | Patient Web Support | Mobile Action / Status |
|---|---|---|---|
| **Notification List** | **YES** (`GET /api/notifications/me?page=1&limit=50`) | Excluded (Web uses live alerts/toasts) | **Reuse**: Fully implemented via `NotificationsApi` & `NotificationsScreen` |
| **Unread Count** | **YES** (`GET /api/notifications/me?is_read=false`) | Excluded | **Reuse**: Count calculated from unread queries & displayed on Home bell badge |
| **Mark as Read** | **YES** (`PATCH /api/notifications/:id/read`) | Excluded | **Reuse**: Server-side update via `NotificationsApi.markAsRead()` |
| **Mark All as Read** | **NO** (Individual ID patch supported) | Excluded | **Handled**: Client iterates unread items to mark each via server API |
| **Notification Details** | **YES** (`id`, `title`, `message`, `type`, `is_read`, `created_at`, `related_entity_id`) | Excluded | **Reuse**: Detail modal with safe formatting |
| **Notification Navigation / Deep Linking** | **YES** (`type` and `related_entity_id` payload) | Excluded | **Reuse**: Safe allowlisted deep linking to `appointments`, `records`, `prescriptions`, `billing`, `documents`, and `dental` |
| **Device Registration** | **NO** | N/A | **Gap**: No push device registration endpoint in backend |
| **Push Token Storage** | **NO** | N/A | **Gap**: No device push token schema or table in backend |
| **FCM (Firebase Cloud Messaging)** | **NO** | N/A | **Gap**: Not configured in HMS backend |
| **APNs (Apple Push Notification)** | **NO** | N/A | **Gap**: Not configured in HMS backend |
| **Foreground Push** | **NO** | N/A | **Native Push**: *NOT AVAILABLE IN CURRENT HMS PUSH CONTRACT* |
| **Background Push** | **NO** | N/A | **Native Push**: *NOT AVAILABLE IN CURRENT HMS PUSH CONTRACT* |
| **Notification Tap / Deep Link** | **YES** (In-app Notification Center) | N/A | **Reuse**: Secure in-app navigation to authorized destination screens |

---

## 3. Supported Notification Types & Navigation Mappings

The backend model defines the following notification types (`apps/api/src/modules/notifications/notification.types.ts`):
- `CALL_NEXT_PATIENT` ➔ Deep links to **Appointments / Visits** (`appointments`)
- `DENTAL_LAB_READY` ➔ Deep links to **Dental Treatment Plans** (`dental`)
- `REFERRAL` ➔ Deep links to **Appointments / Visits** (`appointments`) or **Records** (`records`)
- `GENERAL` ➔ Opens **Notification Details Modal**

---

## 4. Privacy, Security & Patient Context Isolation

1. **Context Isolation**: When switching active patient or dependent, notification queries and unread badge counters are immediately cleared and re-evaluated for the active session.
2. **Deep-Link Whitelist**: Arbitrary URL schemes (`javascript:`, `http:`, raw routes) are rejected. Navigation is restricted to verified internal destination tabs (`home`, `appointments`, `records`, `prescriptions`, `billing`, `documents`, `dental`, `profile`).
3. **Push Token Safety**: No push tokens or private credentials are hardcoded, logged, or exposed.
