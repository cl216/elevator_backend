import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

export enum PrivateSessionRequestStatus {
  OPEN = 'OPEN',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('private_session_requests')
export class PrivateSessionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learner_id' })
  learner: User;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamp', nullable: true })
  requested_date_1: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  requested_date_2: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  requested_date_3: Date | null;

  @Column({ type: 'int', nullable: true })
  requested_duration_minutes: number | null;

  @Column({ type: 'text', nullable: true })
  learner_note: string | null;

  @Column({ type: 'text', nullable: true })
  teacher_response_message: string | null;

  @Column({
    type: 'enum',
    enum: PrivateSessionRequestStatus,
    default: PrivateSessionRequestStatus.OPEN,
  })
  status: PrivateSessionRequestStatus;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  accepted_session_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  declined_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expired_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}