import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherFollowers1772922556760 implements MigrationInterface {
  name = 'AddTeacherFollowers1772922556760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "teacher_followers" ("teacher_id" uuid NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_65adf67acc9952bc321fe15b561" PRIMARY KEY ("teacher_id", "user_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TEACHER_FOLLOWERS_USER_ID" ON "teacher_followers" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TEACHER_FOLLOWERS_TEACHER_ID" ON "teacher_followers" ("teacher_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_followers" ADD CONSTRAINT "FK_9bd84419d08f629ca211b16e3a2" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_followers" ADD CONSTRAINT "FK_05a7922c78cbe15aca355b8da67" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teacher_followers" DROP CONSTRAINT "FK_05a7922c78cbe15aca355b8da67"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_followers" DROP CONSTRAINT "FK_9bd84419d08f629ca211b16e3a2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_TEACHER_FOLLOWERS_TEACHER_ID"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_TEACHER_FOLLOWERS_USER_ID"`,
    );
    await queryRunner.query(`DROP TABLE "teacher_followers"`);
  }
}
