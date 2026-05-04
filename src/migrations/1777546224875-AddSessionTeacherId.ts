import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionTeacherId1777546224875 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "teacher_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sessions_teacher_id"
      ON "sessions" ("teacher_id")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_sessions_teacher_id'
        ) THEN
          ALTER TABLE "sessions"
          ADD CONSTRAINT "FK_sessions_teacher_id"
          FOREIGN KEY ("teacher_id") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP CONSTRAINT IF EXISTS "FK_sessions_teacher_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_sessions_teacher_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN IF EXISTS "teacher_id"
    `);
  }

}
