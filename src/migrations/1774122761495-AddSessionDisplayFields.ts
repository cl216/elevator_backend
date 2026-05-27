import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionDisplayFields1774122761495 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD COLUMN IF NOT EXISTS "image_url_1" text,
      ADD COLUMN IF NOT EXISTS "image_url_2" text,
      ADD COLUMN IF NOT EXISTS "image_url_3" text;
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "rough_location" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN IF EXISTS "rough_location";
    `);

    await queryRunner.query(`
      ALTER TABLE "classes"
      DROP COLUMN IF EXISTS "image_url_1",
      DROP COLUMN IF EXISTS "image_url_2",
      DROP COLUMN IF EXISTS "image_url_3";
    `);
  }

}
