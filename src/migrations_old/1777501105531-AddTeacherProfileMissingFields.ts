import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherProfileMissingFields1777501105531 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      ADD COLUMN IF NOT EXISTS "full_name" text,
      ADD COLUMN IF NOT EXISTS "image_url" text,
      ADD COLUMN IF NOT EXISTS "bio" text,
      ADD COLUMN IF NOT EXISTS "experience" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      DROP COLUMN IF EXISTS "experience",
      DROP COLUMN IF EXISTS "bio",
      DROP COLUMN IF EXISTS "image_url",
      DROP COLUMN IF EXISTS "full_name"
    `);
  }

}
