import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisputeCommentToBookings1779889129857 implements MigrationInterface {
    name = 'AddDisputeCommentToBookings1779889129857'

     public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "dispute_comment" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "dispute_comment"
    `);
  }
}
