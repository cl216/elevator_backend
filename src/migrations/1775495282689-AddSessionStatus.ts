import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionStatus1775495282689 implements MigrationInterface {
    name = 'AddSessionStatus1775495282689'

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."sessions_status_enum" AS ENUM('ACTIVE', 'CANCELLED')
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD "status" "public"."sessions_status_enum" NOT NULL DEFAULT 'ACTIVE'
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD "cancelled_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN "cancelled_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN "status"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."sessions_status_enum"
    `);
  }

}
