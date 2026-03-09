.# Production Smoke Test Checklist

## Core API
- [ ] `GET /health` returns OK
- [ ] Request logs appear in hosting logs

## Auth
- [ ] Register learner works
- [ ] Register teacher works
- [ ] Login works
- [ ] Rate limit works on repeated login attempts

## Sessions / Discovery
- [ ] Sessions load on map
- [ ] Session detail loads

## Trust
- [ ] Follow teacher works
- [ ] Teacher booking trust view works

## Booking / Payments
- [ ] Booking can be created
- [ ] Intro message saves
- [ ] Blocked contact content is rejected
- [ ] Checkout session can be created
- [ ] Stripe webhook confirms booking

## Cron jobs
- [ ] Booking expiry cron logs appear
- [ ] Payout cron logs appear

## Logging
- [ ] Auth logs visible
- [ ] Booking logs visible
- [ ] Payment logs visible
- [ ] Webhook logs visible
- [ ] Cron logs visible