# Elevator Project Roadmap

Marketplace for in-home classes where teachers host sessions and learners discover and book nearby experiences.

---

# Completed Phases

## Core Platform
- [x] Phase 1 — Map discovery
- [x] Phase 2 — Booking engine
- [x] Phase 3 — Stripe checkout
- [x] Phase 4 — Payment safety
- [x] Phase 5 — Delayed payouts
- [x] Phase 5.5 — Duplicate sessions
- [x] Phase 6 — Location privacy
- [x] Phase 7 — Arrival instructions
- [x] Phase 8 — Map clustering
- [x] Phase 8.5 — Follow teachers

## Trust & Safety
- [x] Phase 9 — Trust Stack
  - learner intro message
  - contact blocking / anti-disintermediation
  - learner first name
  - booking trust info

## Infrastructure
- [x] Phase 10 — Production Hardening
  - rate limiting
  - request logging
  - structured logs
  - cron logging
  - health endpoint
  - environment validation
  - deployment checklist
  - backup / restore plan
  - smoke test checklist

---

# Current Milestone
## Phase 11A — Learner Booking Flow MVP

Goal: Complete the core marketplace loop.

Discover → Inspect → Reserve → Pay → Confirm

### Frontend
- [ ] Create `src/api/bookings.ts`
- [ ] Create `src/api/payments.ts`
- [ ] Wire **Reserve button** to booking flow
- [ ] Add **intro message input**
- [ ] Call `POST /bookings`
- [ ] Call `POST /payments/checkout`
- [ ] Redirect to Stripe checkout
- [ ] Handle success redirect
- [ ] Handle cancel redirect
- [ ] Show booking confirmed UI

### UX
- [ ] Loading state during booking creation
- [ ] Error state if booking/payment fails
- [ ] Booking confirmation screen

---

# Phase 11B — Teacher Profile UX

Goal: Improve trust and identity.

### Frontend
- [ ] Create teacher profile screen
- [ ] Route: `/teacher/[id]`
- [ ] Make teacher name in session modal clickable
- [ ] Fetch teacher profile data
- [ ] Show teacher bio
- [ ] Show teacher avatar
- [ ] Follow/unfollow from profile page

### Backend
- [ ] Add public teacher profile endpoint if needed

---

# Phase 11C — Discovery UX Improvements

Goal: Improve map browsing.

### Frontend
- [ ] Convert “Browse classes near you” into filter bar
- [ ] Add category chips
- [ ] Add loading indicator on map fetch
- [ ] Improve modal styling
- [ ] Improve map header styling

### Backend
- [ ] Add optional category filter to `/sessions/map`

Example:
/sessions/map?north=...&south=...&east=...&west=...&category=art

---

# Phase 11D — Teacher Dashboard MVP

Goal: Make teacher side usable.

### Teacher onboarding
- [ ] Teacher profile setup screen
- [ ] Stripe onboarding status UI
- [ ] Stripe onboarding button

### Teacher tools
- [ ] Create class UI
- [ ] Create session UI
- [ ] View own sessions
- [ ] Duplicate session UI
- [ ] Edit arrival instructions UI

### Trust view
- [ ] View bookings for own sessions
- [ ] Show learner trust information

---

# Phase 11E — Auth & Onboarding UX

Goal: Reduce signup friction.

### Auth
- [ ] Google sign-in
- [ ] Email verification flow
- [ ] Forgot password flow
- [ ] Reset password flow

### UX polish
- [ ] Improve login/register styling
- [ ] Better error states
- [ ] Auth loading state

---

# Phase 12 — Notifications

Goal: Improve retention.

### Backend
- [ ] Create `device_tokens` table
- [ ] Store device tokens per user
- [ ] Endpoint to register push token
- [ ] Notification sending service

### Mobile
- [ ] Request push notification permission
- [ ] Send push token to backend

### Notification triggers
- [ ] Booking confirmed notification
- [ ] Session reminder notification
- [ ] Arrival instructions updated notification
- [ ] Teacher posted new class notification

---

# Phase 13 — Admin Tools

Goal: Marketplace moderation.

- [ ] Admin remove session endpoint
- [ ] Admin suspend teacher endpoint
- [ ] Admin issue refund endpoint
- [ ] Admin view payouts
- [ ] Admin view users
- [ ] Admin manage categories

---

# Phase 14 — Teacher Growth Tools

Goal: Help teachers improve classes.

- [ ] Session analytics
- [ ] Attendance stats
- [ ] Repeat learner tracking
- [ ] Improved duplicate session workflow
- [ ] Teacher dashboard metrics

---

# Phase 15 — Reviews

Goal: Add social proof once marketplace has activity.

### Backend
- [ ] Create `reviews` table
- [ ] Migration
- [ ] Review entity
- [ ] Create review endpoint
- [ ] Only allow after session ends
- [ ] One review per booking
- [ ] Aggregate teacher rating

### Frontend
- [ ] Review submission UI
- [ ] Show reviews on teacher profile

---

# Design System & UI Polish

These can be implemented gradually across phases.

- [ ] Define spacing scale
- [ ] Define typography scale
- [ ] Define border radius tokens
- [ ] Create reusable buttons
- [ ] Create reusable cards
- [ ] Create reusable input components
- [ ] Create filter chips
- [ ] Improve modal styling
- [ ] Improve empty states
- [ ] Improve loading states

---

# Marketplace Loop Checklist

The app should support the full loop:

- [x] Discover sessions
- [x] Inspect session details
- [x] Follow teachers
- [ ] Reserve session
- [ ] Pay via Stripe
- [ ] Booking confirmation
- [ ] Attend session
- [ ] Leave review

---

# Long Term Goals

- grow local class supply
- improve teacher retention
- improve learner repeat bookings
- build trusted in-home learning marketplace