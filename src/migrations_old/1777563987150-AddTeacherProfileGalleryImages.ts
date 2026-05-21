import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherProfileGalleryImages1777563987150 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      ADD COLUMN IF NOT EXISTS "image_url_1" text,
      ADD COLUMN IF NOT EXISTS "image_url_2" text,
      ADD COLUMN IF NOT EXISTS "image_url_3" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      DROP COLUMN IF EXISTS "image_url_3",
      DROP COLUMN IF EXISTS "image_url_2",
      DROP COLUMN IF EXISTS "image_url_1"
    `);
  }

}
