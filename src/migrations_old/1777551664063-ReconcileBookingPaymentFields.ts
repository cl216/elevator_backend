import { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileBookingPaymentFields1777551664063 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text,
      ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text,
      ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "amount" integer,
      ADD COLUMN IF NOT EXISTS "currency" text,
      ADD COLUMN IF NOT EXISTS "stripe_charge_id" text,
      ADD COLUMN IF NOT EXISTS "checkout_created_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "payout_status" text,
      ADD COLUMN IF NOT EXISTS "paid_out_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "stripe_transfer_id" text,
      ADD COLUMN IF NOT EXISTS "payout_attempted_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "payout_failure_reason" text
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_stripe_checkout_session_id"
      ON "bookings" ("stripe_checkout_session_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_stripe_payment_intent_id"
      ON "bookings" ("stripe_payment_intent_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_payout_status"
      ON "bookings" ("payout_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_payout_status"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_stripe_payment_intent_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_stripe_checkout_session_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "payout_failure_reason",
      DROP COLUMN IF EXISTS "payout_attempted_at",
      DROP COLUMN IF EXISTS "stripe_transfer_id",
      DROP COLUMN IF EXISTS "paid_out_at",
      DROP COLUMN IF EXISTS "payout_status",
      DROP COLUMN IF EXISTS "checkout_created_at",
      DROP COLUMN IF EXISTS "stripe_charge_id",
      DROP COLUMN IF EXISTS "currency",
      DROP COLUMN IF EXISTS "amount",
      DROP COLUMN IF EXISTS "paid_at",
      DROP COLUMN IF EXISTS "stripe_payment_intent_id",
      DROP COLUMN IF EXISTS "stripe_checkout_session_id"
    `);
  }

}
