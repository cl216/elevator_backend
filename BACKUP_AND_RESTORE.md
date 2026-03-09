# Backup and Restore Plan

## Backup policy
- Daily automatic database backup
- Retention: at least 7 days
- Manual backup before risky migrations

## What is protected
- users
- teacher_profiles
- sessions
- bookings
- payments metadata
- payouts
- follows
- trust messages

## Before important schema changes
1. Take backup
2. Run migration
3. Verify `/health`
4. Run smoke tests

## Restore plan
- Identify latest healthy backup
- Restore to replacement database
- Point app to restored database
- Verify `/health`
- Verify login, bookings, payments, and sessions

## Minimum information to know
- Where backups are stored
- Who can trigger restore
- How long restore takes
- How to verify restored environment