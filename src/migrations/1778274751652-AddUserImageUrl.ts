import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserImageUrl1778274751652 implements MigrationInterface {
    name = 'AddUserImageUrl1778274751652'

      public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "image_url" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "image_url"
    `);
  }
}
