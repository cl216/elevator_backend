import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrivateSessionFields1776338046198 implements MigrationInterface {
  name = 'AddPrivateSessionFields1776338046198'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create enum type for session_type if needed
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'sessions_session_type_enum'
        ) THEN
          CREATE TYPE "public"."sessions_session_type_enum" AS ENUM('GROUP', 'PRIVATE');
        END IF;
      END$$;
    `);

    // 2. Add session_type column safely
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "session_type" "public"."sessions_session_type_enum"
      NOT NULL DEFAULT 'GROUP'
    `);

    // 3. Add private_request_id safely
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "private_request_id" uuid
    `);

    // 4. Add private_invitee_user_id safely
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "private_invitee_user_id" uuid
    `);

    // 5. Add indexes safely
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sessions_session_type"
      ON "sessions" ("session_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sessions_private_request_id"
      ON "sessions" ("private_request_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sessions_private_invitee_user_id"
      ON "sessions" ("private_invitee_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sessions_private_invitee_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sessions_private_request_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sessions_session_type"`);

    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN IF EXISTS "private_invitee_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN IF EXISTS "private_request_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" DROP COLUMN IF EXISTS "session_type"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'sessions_session_type_enum'
        ) THEN
          DROP TYPE "public"."sessions_session_type_enum";
        END IF;
      END$$;
    `);
  }
}