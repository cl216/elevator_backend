import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Point } from 'geojson';
import { User } from '../../users/user.entity';
import { Class } from '../../classes/entities/class.entity';
import { PrivateSessionRequest } from '../../private-lessons/entities/private-lesson-request.entity';

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

export enum SessionType {
  GROUP = 'GROUP',
  PRIVATE = 'PRIVATE',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Class, { nullable: false })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ type: 'timestamp' })
  start_time: Date;

  @Column({ type: 'timestamp' })
  end_time: Date;

@Column({ name: "duration_minutes", type: "int" })
  duration: number;

  @Column({ type: 'int' })
  max_participants: number;

  @Column({ type: 'decimal' })
  price: number;

  
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: Point;

  @Column({ type: 'text', nullable: true })
  rough_location: string | null;

  @Column({ type: 'text', nullable: true })
  arrival_instructions: string | null;

  @Column({ type: 'timestamp', nullable: true })
payout_review_notified_at: Date | null;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({ name: "review_status", type: "text", default: "PENDING_REVIEW" })
reviewStatus: "PENDING_REVIEW" | "ACTIVE" | "REJECTED";

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @Column({
    type: 'enum',
    enum: SessionType,
    default: SessionType.GROUP,
  })
  @Index('idx_sessions_session_type')
  session_type: SessionType;

  @ManyToOne(() => PrivateSessionRequest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'private_request_id' })
  private_request: PrivateSessionRequest | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_sessions_private_invitee_user_id')
  private_invitee_user_id: string | null;
}