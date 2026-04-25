import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrivateSessionFields1776338046198 implements MigrationInterface {
    name = 'AddPrivateSessionFields1776338046198'

   public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create enum type for session_type
    await queryRunner.query(`
      CREATE TYPE "public"."sessions_session_type_enum"
      AS ENUM('GROUP', 'PRIVATE')
    `);

    // 2. Add session_type column
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN "session_type" "public"."sessions_session_type_enum"
      NOT NULL DEFAULT 'GROUP'
    `);

    // 3. Add private_request_id
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN "private_request_id" uuid
    `);

    // 4. Add private_invitee_user_id
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN "private_invitee_user_id" uuid
    `);

    // 5. Add indexes (important for performance later)
    await queryRunner.query(`
      CREATE INDEX "idx_sessions_session_type"
      ON "sessions" ("session_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_sessions_private_request_id"
      ON "sessions" ("private_request_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_sessions_private_invitee_user_id"
      ON "sessions" ("private_invitee_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_sessions_private_invitee_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_sessions_private_request_id"`);
    await queryRunner.query(`DROP INDEX "idx_sessions_session_type"`);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN "private_invitee_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN "private_request_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN "session_type"
    `);

    // Drop enum
    await queryRunner.query(`
      DROP TYPE "public"."sessions_session_type_enum"
    `);
  }

}
