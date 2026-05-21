import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSessionTimestamps1773754837260 implements MigrationInterface {
  name = "UpdateSessionTimestamps1773754837260";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert start_time to timestamptz
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "start_time"
      TYPE timestamptz
      USING "start_time" AT TIME ZONE 'UTC'
    `);

    // Convert end_time to timestamptz
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "end_time"
      TYPE timestamptz
      USING "end_time" AT TIME ZONE 'UTC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert start_time back to timestamp
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "start_time"
      TYPE timestamp
      USING "start_time"::timestamp
    `);

    // Revert end_time back to timestamp
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "end_time"
      TYPE timestamp
      USING "end_time"::timestamp
    `);
  }
}