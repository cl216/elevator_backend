import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationTable1773835650947 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying(50) NOT NULL,
        "title" character varying(120) NOT NULL,
        "body" text NOT NULL,
        "payload" jsonb,
        "read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_id_created_at"
      ON "notifications" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_id_read"
      ON "notifications" ("user_id", "read")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_notifications_user_id_read"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."IDX_notifications_user_id_created_at"
    `);

    await queryRunner.query(`
      DROP TABLE "notifications"
    `);
  }

}
