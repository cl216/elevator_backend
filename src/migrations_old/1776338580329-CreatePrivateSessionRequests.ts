import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePrivateSessionRequests1776338580329 implements MigrationInterface {
  name = 'CreatePrivateSessionRequests1776338580329'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'private_session_requests_status_enum'
        ) THEN
          CREATE TYPE "public"."private_session_requests_status_enum" AS ENUM(
            'OPEN',
            'ACCEPTED',
            'DECLINED',
            'EXPIRED',
            'CANCELLED'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "private_session_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message" text NOT NULL,
        "requested_date_1" TIMESTAMP,
        "requested_date_2" TIMESTAMP,
        "requested_date_3" TIMESTAMP,
        "requested_duration_minutes" integer,
        "learner_note" text,
        "status" "public"."private_session_requests_status_enum" NOT NULL DEFAULT 'OPEN',
        "accepted_at" TIMESTAMP,
        "declined_at" TIMESTAMP,
        "expired_at" TIMESTAMP,
        "cancelled_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "learner_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        CONSTRAINT "PK_private_session_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_private_session_requests_teacher_id"
      ON "private_session_requests" ("teacher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_private_session_requests_learner_id"
      ON "private_session_requests" ("learner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_private_session_requests_status"
      ON "private_session_requests" ("status")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_private_session_requests_learner_id'
        ) THEN
          ALTER TABLE "private_session_requests"
          ADD CONSTRAINT "FK_private_session_requests_learner_id"
          FOREIGN KEY ("learner_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_private_session_requests_teacher_id'
        ) THEN
          ALTER TABLE "private_session_requests"
          ADD CONSTRAINT "FK_private_session_requests_teacher_id"
          FOREIGN KEY ("teacher_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "private_session_requests"
      DROP CONSTRAINT IF EXISTS "FK_private_session_requests_teacher_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "private_session_requests"
      DROP CONSTRAINT IF EXISTS "FK_private_session_requests_learner_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_private_session_requests_status"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_private_session_requests_learner_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_private_session_requests_teacher_id"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "private_session_requests"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'private_session_requests_status_enum'
        ) THEN
          DROP TYPE "public"."private_session_requests_status_enum";
        END IF;
      END$$;
    `);
  }
}