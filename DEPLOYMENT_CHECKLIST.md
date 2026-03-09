# Deployment Checklist

## Pre-deploy
- [ ] Confirm `synchronize: false`
- [ ] Confirm all migrations are committed
- [ ] Confirm `.env` / production secrets are present
- [ ] Confirm Stripe keys and webhook secret are correct
- [ ] Confirm checkout URLs are correct
- [ ] Confirm app builds successfully
- [ ] Confirm `/health` works locally

## Deploy
- [ ] Deploy backend code
- [ ] Run database migrations
- [ ] Start/restart application
- [ ] Confirm app booted without config validation errors

## Post-deploy smoke test
- [ ] `GET /health` returns `ok: true`
- [ ] Register works
- [ ] Login works
- [ ] Session loading works
- [ ] Booking creation works
- [ ] Checkout session creation works
- [ ] Stripe webhook confirms booking
- [ ] Booking expiry cron logs appear
- [ ] Payout cron logs appear

## Logging checks
- [ ] Request logs visible
- [ ] Auth logs visible
- [ ] Booking logs visible
- [ ] Payment/webhook logs visible
- [ ] Cron logs visible

## Rollback notes
- [ ] Know previous deploy version
- [ ] Know how to restore DB backup if migration causes issues
- [ ] Know how to revert migration if needed