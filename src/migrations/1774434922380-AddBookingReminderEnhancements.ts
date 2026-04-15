import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingReminderEnhancements1774434922380 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "reminder_24h_failed_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "reminder_1h_sent_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "reminder_1h_failed_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_reminder_24h_status_sent"
      ON "bookings" ("status", "reminder_24h_sent_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_reminder_1h_status_sent"
      ON "bookings" ("status", "reminder_1h_sent_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_reminder_1h_status_sent"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_reminder_24h_status_sent"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "reminder_1h_failed_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "reminder_1h_sent_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "reminder_24h_failed_at"
    `);
  }
}
