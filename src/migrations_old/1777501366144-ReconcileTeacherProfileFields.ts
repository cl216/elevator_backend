import { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileTeacherProfileFields1777501366144 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      ADD COLUMN IF NOT EXISTS "full_name" text,
      ADD COLUMN IF NOT EXISTS "bio" text,
      ADD COLUMN IF NOT EXISTS "image_url" text,
      ADD COLUMN IF NOT EXISTS "stripe_account_id" text,
      ADD COLUMN IF NOT EXISTS "stripe_enabled" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_teacher_profiles_user_id'
        ) THEN
          ALTER TABLE "teacher_profiles"
          ADD CONSTRAINT "FK_teacher_profiles_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      DROP CONSTRAINT IF EXISTS "FK_teacher_profiles_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      DROP COLUMN IF EXISTS "stripe_enabled",
      DROP COLUMN IF EXISTS "stripe_account_id",
      DROP COLUMN IF EXISTS "image_url",
      DROP COLUMN IF EXISTS "bio",
      DROP COLUMN IF EXISTS "full_name"
    `);
  }

}
