import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefundFailureReasonToBookings1774217768559 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "refund_failure_reason" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "refund_failure_reason"
    `);
  }
}
