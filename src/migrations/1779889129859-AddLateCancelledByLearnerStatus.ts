import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLateCancelledByLearnerStatus1779889129857
  implements MigrationInterface
{
  name = 'AddLateCancelledByLearnerStatus1779889129857';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE bookings_status_enum
      ADD VALUE IF NOT EXISTS 'LATE_CANCELLED_BY_LEARNER'
    `);
  }

  public async down(): Promise<void> {}
}