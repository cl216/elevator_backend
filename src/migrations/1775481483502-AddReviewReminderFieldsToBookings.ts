import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewReminderFieldsToBookings1775481483502 implements MigrationInterface {
    name = 'AddReviewReminderFieldsToBookings1775481483502'

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "review_reminder_sent_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "review_reminder_failed_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_review_reminder_sent_at"
      ON "bookings" ("review_reminder_sent_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_review_reminder_sent_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "review_reminder_failed_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "review_reminder_sent_at"
    `);
  }   
}
