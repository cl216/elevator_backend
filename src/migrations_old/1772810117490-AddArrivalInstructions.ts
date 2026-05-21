import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArrivalInstructions1772810117490 implements MigrationInterface {
  name = 'AddArrivalInstructions1772810117490';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "arrival_instructions" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN IF EXISTS "arrival_instructions"
    `);
  }
}
