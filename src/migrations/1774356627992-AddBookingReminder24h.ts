import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingReminder24h1774356627992 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "reminder_24h_sent_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_reminder_24h_due"
      ON "bookings" ("status", "reminder_24h_sent_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_reminder_24h_due"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "reminder_24h_sent_at"
    `);
  }

}
