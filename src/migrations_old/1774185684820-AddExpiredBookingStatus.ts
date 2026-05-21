import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExpiredBookingStatus1774185684820 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum"
      ADD VALUE IF NOT EXISTS 'EXPIRED'
    `);
  }

  public async down(): Promise<void> {
    // Postgres enum values are not easily removable in down migrations.
    // Intentionally left empty.
  }

}
