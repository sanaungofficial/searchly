# Platform Communications — Phase 1 Discovery

**Branch:** `feat/platform-comms` (off `dev`)  
**Owner:** Platform comms agent  
**North star:** When new jobs match me, I hear about it. When a coach I follow hosts a webinar, I get email + SMS. Coaches can shout out to people who opted in — compliantly.

**Providers (decided):** Email → Resend · SMS → Twilio (new)

---

## 1. Outbound email audit (today)

All sends use `Kimchi <hello@kimchi.so>` via Resend unless noted. No Twilio/SMS exists yet.

| Product | Template / function | Trigger | Recipient | Opt-out | Prod / staging gates |
|--------|---------------------|---------|-----------|---------|----------------------|
| **Welcome** | `sendWelcomeEmail` (`email.ts`) | New user on first auth (`sync-auth-user.ts`) | Signup email | None (transactional) | Requires `RESEND_API_KEY`; no allowlist |
| **Daily job match digest** | `sendRecommendedJobsDigestEmail` (`recommended-jobs-email.ts`) | Cron `0 8 * * *` → `runRecommendedJobsSnapshotCron` | Users with profile, `dailyEmailEnabled`, new jobs ≥ min score since last send | Signed link → `/api/email/digest-unsubscribe` → sets `dailyEmailEnabled=false` | **`DIGEST_EMAIL_LIVE=true`** OR **`DIGEST_EMAIL_ALLOWLIST`**; user toggle in Settings; min score default **60** (`RECOMMENDED_DIGEST_MIN_SCORE`); max **3** jobs/email; only sends if **new** job IDs since `lastDigestJobIds` |
| **Digest admin test** | Same builder | Admin panel → `/api/admin/digest-test` POST | Arbitrary address (admin-specified) | N/A (manual) | No live gate on admin send; needs `RESEND_API_KEY` |
| **Live — registration confirm** | `sendLiveSessionRegistrationEmail` | POST `/api/live/register` (new registration) | Registrant | None today | `RESEND_API_KEY` |
| **Live — reminder** | `sendLiveSessionReminderEmail` | Cron `*/5` → ~**15 min before** start (not 24h/1h) | Registrants where `reminderSentAt` is null | None today | `RESEND_API_KEY` |
| **Live — live now** | `sendLiveSessionLiveNowEmail` | Session goes LIVE → `notifyLiveSessionLiveNow` | All registrants (once per session) | None today | `RESEND_API_KEY` |
| **Live — post-session** | `sendLiveSessionPostSessionEmail` | Session ENDED → cron or auto-end; attendees who **joined** | Registrants with `joinedAt` set | None today | `RESEND_API_KEY` |
| **Live — coach follower blast** | Inline in `notifyCoachFollowersLive` | Session goes LIVE (once per session) | All `CoachFollow` rows for session's coach | None today | `RESEND_API_KEY` |
| **Booking — guest confirm** | `sendBookingGuestConfirmationEmail` | Nylas webhook (booking created) | Guest | None (transactional) | `RESEND_API_KEY`; logged to `CoachBookingCommunication` |
| **Booking — coach notify** | `sendBookingCoachNotificationEmail` | Nylas webhook | Coach | N/A | Same |
| **Booking — cancellation** | `sendBookingCancelledEmail` | Nylas webhook | Guest | N/A | Same |
| **Discovery lead (internal)** | `sendDiscoveryLeadEmail` | POST `/api/leads/discovery` | `DISCOVERY_LEAD_EMAIL` (default San) | N/A | `RESEND_API_KEY` |
| **Event interest (internal)** | `sendEventInterestEmail` | POST `/api/leads/event-interest` | `EVENT_INTEREST_EMAIL` | N/A | `RESEND_API_KEY` |

**Not built:** billing/subscription emails (Stripe portal only), instant job-match push, marketing broadcasts, coach-authored blasts, SMS of any kind, unified comms log (except `CoachBookingCommunication` + `LiveSessionEvent`).

### Digest behavior (important details)

- Cron always builds snapshots for eligible users (profile + engine eligibility); email is a second step.
- User opt-in defaults **`dailyEmailEnabled: true`** (`UserDigestSettings`).
- Automated send requires: user toggle ON + env gate + at least one **new** job above min score + not already sent today.
- Schema comment mentions "80+ matches"; code uses configurable min score (default **60**) and up to 3 jobs.

### Live email gaps vs Laylo vision

- Reminder is single window (~15 min), not 24h + 1h.
- No SMS on register / reminder / live / post-session.
- No phone or `smsOptIn` on `LiveSessionRegistration`.
- Follower notify has no opt-out and no SMS.
- No per-registration comms preferences.

### Template duplication

Three separate `emailShell` implementations: `email.ts`, `live-session-emails.ts`, `booking-emails.ts`. Digest uses inline HTML in `recommended-jobs-email.ts`.

---

## 2. Communication products (proposed scope)

### A. Job seeker (platform → user)

| Feature | Status | v1 proposal |
|---------|--------|-------------|
| Daily job match digest | Built | **P0** — improve + enable live safely |
| Instant notify on strong new match | Not built | **P2** — daily only for now (San confirmed) |
| Welcome email | Built | **P0** — fold into unified sender |
| Billing / product emails | Stripe-hosted | Out of scope v1 |

### B. Live / webinar (coach → registrants + followers)

| Feature | Status | v1 proposal |
|---------|--------|-------------|
| Registration confirm (email) | Built | **P0** |
| Reminder 24h / 1h | Partial (15 min only) | **P1** — add 24h + 1h email; keep 15 min |
| Live now (email) | Built | **P0** |
| Post-session (email) | Built | **P1** |
| SMS on register / reminder / live | Not built | **P0** |
| Coach shoutout to opted-in registrants | Not built | **P0** MVP |

### C. Coach marketing

| Feature | Status | v1 proposal |
|---------|--------|-------------|
| Followers notified when coach goes live | Partial (email only) | **P1** — add SMS for opted-in followers |
| Coach-initiated campaigns | Not built | **P0** — session registrants who opted in |

---

## 3. Compliance & consent

### Email (CAN-SPAM)

| Message class | Unsubscribe today | v1 requirement |
|---------------|-------------------|----------------|
| Job digest | Yes (signed token) | Keep; sync with Settings toggle (already does) |
| Live transactional (register, reminder, live now) | No | Footer: "Manage notifications in Kimchi" — no marketing unsub required if truly transactional |
| Coach follower / shoutout | No | **Required** — link to comms preferences |
| Welcome / booking | No | Transactional OK |

### SMS (TCPA) — must have before any send

1. **Explicit opt-in** — unchecked by default; separate from email where possible.
2. **Consent record** — phone, timestamp, IP/user-agent, consent text version, channel scope.
3. **STOP handling** — Twilio inbound webhook → set `smsOptIn=false`, log event.
4. **Help text** — "Reply STOP to unsubscribe. Msg&data rates may apply."
5. **Allowlist on dev** — `SMS_ALLOWLIST=+1...` mirroring digest pattern.

### Where phone + opt-in live (San confirmed)

| Surface | Purpose |
|---------|---------|
| **Live registration form** | Collect phone + SMS opt-in for *this session's* webinar comms |
| **Profile (Kimchi account)** | Persistent phone + global SMS preferences (requires profile) |

Phone today exists only in `Profile.parsedData.phone` (resume parse). v1 needs first-class fields (see schema sketch).

### Sender identity (San confirmed)

- SMS and email from **Kimchi** infrastructure.
- Coach name in **from-display** / body: e.g. `"Kimchi · Maya Chen" <hello@kimchi.so>` and SMS prefix `"Maya Chen via Kimchi: …"`.
- Not coach-branded Twilio numbers in v1.

---

## 4. Technical architecture (Phase 2 proposal)

```
src/lib/comms/
  index.ts           — public API
  send-email.ts      — Resend wrapper, allowlist, idempotency key
  send-sms.ts        — Twilio Messaging Service wrapper
  templates/         — shared emailShell, SMS body builders
  allowlist.ts       — digest + SMS + live email gates
  idempotency.ts     — dedupe cron retries (sessionId + userId + template)
  types.ts
```

### Audience & preferences

Extend data model rather than Resend Audiences for v1 (auditable, TCPA-friendly):

- **`CommunicationPreference`** (1:1 with `User`) — email digest, SMS webinar, SMS marketing, phone E.164, consent fields.
- **`LiveSessionRegistration`** — add `phone`, `smsOptIn`, `smsOptInAt`, per-session overrides.
- **`CommunicationLog`** — channel, template, recipient, status, idempotencyKey, metadata (replaces ad-hoc logging over time).

### Send paths

| Path | When | Queue |
|------|------|-------|
| Immediate | Registration confirm, coach shoutout (small batch) | In-request or fire-and-forget with log |
| Cron | Digest daily, live reminders, live-now fan-out | Existing Vercel crons |
| Webhook | Twilio STOP/HELP | New `/api/webhooks/twilio` |

### Idempotency (critical for SMS)

Use composite keys, e.g. `live-reminder:{sessionId}:{userId}`, stored on `CommunicationLog` or registration flags (`reminderSentAt` already exists for email).

### Dev / staging

| Env | Purpose |
|-----|---------|
| `DIGEST_EMAIL_LIVE` | `true` = cron sends digest to all eligible users |
| `DIGEST_EMAIL_ALLOWLIST` | Comma emails; overrides live when set |
| `SMS_LIVE` | Mirror of digest live gate |
| `SMS_ALLOWLIST` | E.164 numbers allowed in non-prod |
| `COMMS_EMAIL_ALLOWLIST` | Optional gate for live/booking emails in staging |

---

## 5. Schema sketch (needs San approval — `schema.prisma` is sacred)

```prisma
model CommunicationPreference {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(...)

  phoneE164             String?  // canonical SMS destination
  phoneVerifiedAt       DateTime?

  emailDigestEnabled    Boolean  @default(true)  // migrate from UserDigestSettings or alias
  smsWebinarEnabled     Boolean  @default(false)
  smsMarketingEnabled   Boolean  @default(false)

  smsOptInAt            DateTime?
  smsOptInSource        String?  // "live_registration" | "profile" | ...
  smsOptInTextVersion   String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model CommunicationLog {
  id              String   @id @default(cuid())
  userId          String?
  channel         CommunicationChannel  // EMAIL | SMS
  template        String   // job_digest | live_register | live_reminder_1h | coach_shoutout | ...
  recipient       String   // email or E.164
  status          CommunicationStatus   // QUEUED | SENT | FAILED | SKIPPED
  idempotencyKey  String?  @unique
  providerId      String?  // Resend/Twilio message id
  errorMessage    String?
  metadata        Json?
  createdAt       DateTime @default(now())

  @@index([userId, createdAt])
  @@index([template, createdAt])
}

// LiveSessionRegistration additions:
//   phoneE164 String?
//   smsOptIn Boolean @default(false)
//   smsOptInAt DateTime?
//   reminder24hSentAt DateTime?
//   reminder1hSentAt DateTime?
//   smsReminderSentAt DateTime?
//   smsLiveNowSentAt DateTime?
```

**Migration note:** `UserDigestSettings` can remain for digest job state (`lastDigestJobIds`, `lastDigestSentAt`) while preferences consolidate into `CommunicationPreference`, or we extend `UserDigestSettings` in place to avoid two toggles — recommend single source of truth in Settings UI.

---

## 6. Priority matrix

### P0 — v1 MVP (after approval)

1. Unified `src/lib/comms/` email sender + shared template shell
2. Job digest — safe live rollout (allowlist → live), admin metrics, unsubscribe ↔ settings verified
3. Live registration — phone + SMS opt-in fields on form + API
4. Twilio integration — register confirm SMS, 1h reminder SMS, live-now SMS (opt-in only)
5. Profile — phone + SMS webinar toggle (sync with registration opt-in)
6. Coach shoutout MVP — pick session → compose → email + SMS to **opted-in registrants**
7. `CommunicationLog` + idempotency for cron paths
8. Twilio STOP webhook

### P1 — fast follow

- 24h + 1h email reminders (currently only ~15 min)
- SMS for coach follower live notify (opt-in followers with phone)
- Extend unsubscribe / preferences page for live + marketing
- Admin comms dashboard (sent/failed counts)

### P2 — later

- Instant job-match notify (event hook from Opportunities agent)
- Resend Broadcasts for large lists
- Phone verify via `TWILIO_VERIFY`
- Per-coach send analytics

### Out of scope v1

- Nylas inbox / job-email agent
- Real-time push notifications
- Coach-branded SMS numbers
- Billing emails

---

## 7. Env & provider checklist

### Resend (existing)

- [x] `RESEND_API_KEY` on Vercel (preview + production)
- [x] `hello@kimchi.so` domain verified
- [ ] `DIGEST_UNSUBSCRIBE_SECRET` (prod — do not rely on `CRON_SECRET` fallback)
- [ ] Decide: `DIGEST_EMAIL_LIVE=true` on prod vs allowlist on dev

### Twilio (new)

- [ ] Create Twilio account / subaccount for Kimchi
- [ ] **Messaging Service** with US long code or toll-free
- [ ] **A2P 10DLC** registration (US marketing/notification at scale — allow 2–4 weeks)
- [ ] Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`
- [ ] Optional: `TWILIO_VERIFY` for phone confirmation on profile
- [ ] Inbound webhook URL for STOP → `/api/webhooks/twilio`
- [ ] `SMS_ALLOWLIST` on dev/preview

### Cron / secrets (existing)

- [x] `CRON_SECRET` for Vercel cron auth
- [x] Crons: digest `0 8 * * *`, live `*/5 * * * *`

---

## 8. Handoffs

| Agent | Need |
|-------|------|
| **Live** | Registration form UI — phone input, SMS opt-in checkbox, consent copy |
| **Provider/coach** | Coach portal UI for shoutout compose + send |
| **Backend** | Schema approval + migration for `CommunicationPreference`, `CommunicationLog`, registration fields |
| **Opportunities** | Event hook if instant notify added (P2) |
| **QA** | Prod send tests with San email/phone on allowlists |

---

## 9. San decisions captured + open questions

### Confirmed this session

1. **Job matches:** Daily digest for now — not instant notify.
2. **SMS opt-in surfaces:** Live registration page **and** profile settings (users need a Kimchi profile).
3. **Coach blast sender:** From Kimchi platform, **with coach's name** in display/body — not a separate coach number.

### Still need your call

1. **Digest rollout:** Turn on `DIGEST_EMAIL_LIVE=true` for all eligible prod users now, or keep allowlist until we've watched a week of cron metrics?
2. **Coach shoutout audience:** **Session registrants who opted in** only — or also **all followers** of the coach? (Recommend registrants-only for v1 TCPA simplicity.)
3. **v1 boundary:** Confirm P0 list above — anything to cut (e.g. defer post-session SMS) or add?
4. **Reminder schedule:** Keep ~15 min email reminder and **add** 24h + 1h email/SMS — or replace 15 min with 1h only?
5. **Schema:** OK to add `CommunicationPreference` + `CommunicationLog` + registration phone fields via coordinated migration?

---

## 10. Phase 2 build order (after approval)

1. Unify email sending — shared templates, `emailShell`, delivery logging  
2. Job digest — enable live mode safely, admin metrics, unsubscribe ↔ settings sync  
3. Live session SMS — phone + `smsOptIn` on registration; Twilio on register / reminder / live  
4. Communication preferences API + Profile/Settings UI  
5. Coach shoutout MVP — session → compose → opted-in registrants (email + SMS)  
6. Rate limits, idempotency, admin error visibility  
7. Optional: Resend Broadcasts if batch > ~500 recipients  

---

**Approve v1?** Reply with answers to the five open questions (§9) and we'll start Phase 2 on `feat/platform-comms` → PR to `dev`.
