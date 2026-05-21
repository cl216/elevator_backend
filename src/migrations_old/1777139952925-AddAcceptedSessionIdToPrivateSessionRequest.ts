import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAcceptedSessionIdToPrivateSessionRequests1777139952925 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "private_session_requests"
      ADD COLUMN "accepted_session_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_private_session_requests_accepted_session_id"
      ON "private_session_requests" ("accepted_session_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_private_session_requests_accepted_session_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "private_session_requests"
      DROP COLUMN "accepted_session_id"
    `);
  }
}
