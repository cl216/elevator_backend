import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrivateLessonRequests1776337086052 implements MigrationInterface {
    name = 'AddPrivateLessonRequests1776337086052'

public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "private_lesson_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "learner_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "category" character varying(100),
        "note" text,
        "preferred_date" TIMESTAMP WITH TIME ZONE,
        "preferred_time_label" character varying(120),
        "duration_minutes" integer,
        "area_label" character varying(160),
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_private_lesson_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_private_lesson_requests_teacher_id"
      ON "private_lesson_requests" ("teacher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_private_lesson_requests_learner_id"
      ON "private_lesson_requests" ("learner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_private_lesson_requests_status"
      ON "private_lesson_requests" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_private_lesson_requests_status"`);
    await queryRunner.query(`DROP INDEX "idx_private_lesson_requests_learner_id"`);
    await queryRunner.query(`DROP INDEX "idx_private_lesson_requests_teacher_id"`);
    await queryRunner.query(`DROP TABLE "private_lesson_requests"`);
  }

}
