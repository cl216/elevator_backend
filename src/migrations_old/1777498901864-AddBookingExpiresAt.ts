import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingExpiresAt1777498901864 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_expires_at"
      ON "bookings" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_bookings_expires_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "expires_at"
    `);
  }

}
