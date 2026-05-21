import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherProfileFullName1777501009809 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      ADD COLUMN IF NOT EXISTS "full_name" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      DROP COLUMN IF EXISTS "full_name"
    `);
  }

}
