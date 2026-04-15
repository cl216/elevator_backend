


# Elevator Roadmap

## Completed

### Phase 1 — Identity & User Model
- [x] Remove learner/teacher role selection
- [x] Unified signup flow
- [x] All users start as normal users
- [x] Add Become a teacher CTA
- [x] Teacher onboarding flow
- [x] Create teacher profile
- [x] Stripe onboarding for payouts
- [x] Unlock Teach tab
- [x] Dynamically show Teach tab
- [x] Prevent teachers booking their own sessions
- [x] Add Bookings tab for learners

### Phase 3 — Structured Communication
- [x] Learner intro message in booking flow
- [x] Show intro message in teacher dashboard
- [x] Teacher class/session message foundation exists
- [x] Arrival instructions implemented
- [x] Arrival instructions editable by teacher

### Phase 4 — Discovery Improvements
- [x] Show people going
- [x] Show spots left

### Phase 5 — Community Signals
- [x] Show first names of attendees

### Phase 6 — Map UX & Reliability
- [x] Map discovery
- [x] Marker clustering
- [x] Category filtering
- [x] Search this area button
- [x] Nearby suggestions
- [x] /sessions/nearby endpoint
- [x] Suggest 3 nearest sessions
- [x] Suggestion box close button
- [x] Tapping suggestion zooms to map location
- [x] Recenter-to-user button
- [x] “You are here” location marker
- [x] Stop auto-fetching sessions on pan
- [x] Faster Search this area appearance
- [ ] Preserve markers while fetching
- [ ] Highlight selected marker
- [ ] Slight lift animation for selected marker

### Teacher Tools / Core Marketplace
- [x] Map discovery
- [x] Session modal
- [x] Booking flow
- [x] Teacher dashboard
- [x] Create class
- [x] Create session
- [x] Address autocomplete
- [x] Map location preview
- [x] Duplicate session
- [x] Cancel safeguards
- [x] View bookings
- [x] Learner bookings screen
- [x] Friendlier Stripe gating for session creation

### Payments
- [x] Stripe checkout
- [x] Delayed payouts
- [x] Booking lifecycle

---

## Still To Do

### Phase 2 — Notifications
- [ ] Push notifications
- [ ] In-app notification inbox
- [ ] Unread indicators
- [ ] Badge counters
- [ ] Booking confirmation email
- [ ] Session reminder email
- [ ] Cancellation emails

### Auth / Account Security
- [ ] Proper forgot-password email flow polish
- [ ] Email verification flow polish
- [ ] Deep link app handling for verification/reset
- [ ] Buy custom domain for Resend
- [ ] Send branded production emails from custom domain

### Phase 3 — Structured Communication Polish
- [x] Confirm teacher class/session message is shown before booking
- [x] Confirm teacher class/session message is shown in session modal
- [x] Confirm teacher class/session message is shown after booking
- [ ] Ensure arrival instructions are clearly visible after booking
- [ ] Clean up wording / presentation

### Phase 6 — Map UX Polish
- [x] Recheck preserve markers while fetching
- [ ] Selected marker highlight state
- [ ] Selected marker lift animation

### Phase 7 — Explanation Cards
- [x] Reusable ExplainCard component
- [x] Persist dismissed cards in local storage
- [x] Show each card once
- [x] Learner map intro card
- [x] Teacher teach tab intro
- [x] Session creation hint
- [x] Bookings page explanation
- [ ] First booking celebration card
- [x] Overall polish

### Phase 8 — Teacher Supply Growth
- [ ] Weekly recurrence
- [ ] Bi-weekly recurrence
- [ ] Monthly recurrence
- [ ] Repeat for X weeks
- [ ] Quick repeat next week

### Phase 9 — Teacher Insights
- [ ] session_views table
- [ ] Track session modal views
- [ ] Show views in teacher dashboard

### Phase 10 — Viral Growth
- [ ] Invite a friend
- [ ] Share session link
- [ ] Native share sheet
- [ ] Deep linking for shared sessions
- [ ] Public session preview page
- [ ] Open shared session in app
- [ ] Book together later

### Phase 11 — Demand Signals
- [x] class_requests table
- [x] Request a class flow for empty areas
- [x] Capture category + location
- [x] Teacher demand dashboard
- [x] Allowing teachers to create new categories following approval
- [ ] Demand heatmap later

### Phase 12 — Reviews & Ratings
- [ ] Teacher star ratings
- [ ] Written reviews
- [ ] Class quality rating
- [ ] Group experience rating

### Phase 13 — Payments & Finance
- [ ] Teacher cancellation refunds
- [ ] Learner cancellation refunds
- [ ] Teacher earnings dashboard
- [ ] possible recepts needed to users and teachers?


### Phase 14 — Admin & Moderation
- [ ] Admin dashboard
- [ ] Manage users
- [ ] Manage sessions
- [ ] Handle reports
- [ ] Moderation tools

### Phase 15 — City Launch Strategy
- [ ] Recruit 5–10 teachers
- [ ] Seed 30–50 sessions
- [ ] Encourage recurring sessions
- [ ] Focus supply in central neighborhoods
- [ ] Ensure clusters appear on map


###### Make sure:
- [ ] make sure real teacher location gets exposed to learners once they have booked
- [ ] receipts?
- [ ] cleanup + polish
- [ ] Teacher booking own session equals 500 error
- [ ] email password verification
- [ ] on long app sleep, token expires for notifications(and maybe other)
- [] polish map and flow
- [] polish helper cards(older tech-weak adults need to use app)
- [] temp disable resend to allow teting
- [] double opening sessions error
- maybe make classes+sessions coupling just one for ease of use.
- teachers name and avatar on session/class clicking to teacher profile
- TEACHERS CONFIRM PENDING BOOKING AND THIS NOTIFIES USER
- USER DOESNT NEED TO GO THROUGH STRIPE PAYMENT EVERY TIME, QUICK BUY CLASSES[express account?]
- ensure follow funtionality is working
- dont show reserve or booking in own bookers session
- when user goes back into app after exitting, but still logged in, map markers should be updated

issue with closing app and token expiring