import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewStatusToSessions1778082433155 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN "review_status" text NOT NULL DEFAULT 'PENDING_REVIEW'
    `);

    await queryRunner.query(`
      UPDATE "sessions"
      SET "review_status" = 'ACTIVE'
      WHERE "review_status" = 'PENDING_REVIEW'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN "review_status"
    `);
  }
}
