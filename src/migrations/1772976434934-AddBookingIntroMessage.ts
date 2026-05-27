import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingIntroMessage1773000000000 implements MigrationInterface {
  name = 'AddBookingIntroMessage1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "intro_message" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "intro_message"
    `);
  }
}
