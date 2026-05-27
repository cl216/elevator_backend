import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionStatus1775495282689 implements MigrationInterface {
  name = 'AddSessionStatus1775495282689'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Create enum only if it doesn't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'sessions_status_enum'
        ) THEN
          CREATE TYPE "public"."sessions_status_enum" AS ENUM('ACTIVE', 'CANCELLED');
        END IF;
      END$$;
    `);

    // 2) Add status column safely
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "status" "public"."sessions_status_enum" NOT NULL DEFAULT 'ACTIVE'
    `);

    // 3) Add cancelled_at safely
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN IF EXISTS "cancelled_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN IF EXISTS "status"
    `);

    // Drop enum only if it exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'sessions_status_enum'
        ) THEN
          DROP TYPE "public"."sessions_status_enum";
        END IF;
      END$$;
    `);
  }
}