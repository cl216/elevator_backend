import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefundRetryFields1774345352338 implements MigrationInterface {
  name = 'AddRefundRetryFields1774345352338';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "refund_retry_count" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "refund_last_retry_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "refund_next_retry_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_refund_retry_due"
      ON "bookings" ("status", "refund_next_retry_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_refund_retry_due"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "refund_next_retry_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "refund_last_retry_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "refund_retry_count"
    `);
  }
}