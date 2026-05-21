import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherResponseMessageToPrivateSessionRequests1776965029779 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "private_session_requests"
      ADD COLUMN "teacher_response_message" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "private_session_requests"
      DROP COLUMN "teacher_response_message"
    `);
  }

}
