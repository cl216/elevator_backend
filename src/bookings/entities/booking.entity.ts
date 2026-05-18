import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Session } from '../../sessions/entities/session.entity';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED_BY_LEARNER = 'CANCELLED_BY_LEARNER',
  CANCELLED_BY_TEACHER = 'CANCELLED_BY_TEACHER',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
  REFUND_FAILED = 'REFUND_FAILED',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
  LEARNER_NO_SHOW = 'LEARNER_NO_SHOW',
  TEACHER_NO_SHOW = 'TEACHER_NO_SHOW',
  DISPUTED = 'DISPUTED',
}

export enum PayoutStatus {
  NOT_PAID_OUT = 'NOT_PAID_OUT',
  PAID_OUT = 'PAID_OUT',
  PAYOUT_FAILED = 'PAYOUT_FAILED',
}

@Entity('bookings')
@Index(['user', 'session'], { unique: true })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Session, { nullable: false })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  intro_message: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by_user_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  refunded_at: Date | null;

  @Column({ type: 'int', nullable: true })
  refund_amount: number | null;

  @Column({ type: 'text', nullable: true })
  stripe_refund_id: string | null;

  @Column({ type: 'text', nullable: true })
  refund_failure_reason: string | null;

  @Column({ type: 'int', default: 0 })
  refund_retry_count: number;

  @Column({ type: 'timestamp', nullable: true })
  refund_last_retry_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refund_next_retry_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  reminder_24h_sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  reminder_24h_failed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  reminder_1h_sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  reminder_1h_failed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  review_reminder_sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  review_reminder_failed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  stripe_checkout_session_id: string | null;

  @Column({ type: 'text', nullable: true })
  stripe_payment_intent_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  /**
   * Total amount charged to the learner, in cents.
   * This should equal total_amount once checkout is created.
   */
  @Column({ type: 'int', nullable: true })
  amount: number | null;

  /**
   * Lesson base price, in cents.
   */
  @Column({ type: 'int', nullable: true })
  lesson_amount: number | null;

  /**
   * Elevator platform/service fee charged to learner, in cents.
   */
  @Column({ type: 'int', nullable: true })
  platform_fee_amount: number | null;

  /**
   * Estimated Stripe/payment processing fee charged to learner, in cents.
   */
  @Column({ type: 'int', nullable: true })
  stripe_fee_amount: number | null;

  /**
   * Full learner charge, in cents.
   * lesson_amount + platform_fee_amount + stripe_fee_amount.
   */
  @Column({ type: 'int', nullable: true })
  total_amount: number | null;

  /**
   * Amount the teacher should receive, in cents.
   * Payout cron must use this, not amount.
   */
  @Column({ type: 'int', nullable: true })
  teacher_payout_amount: number | null;

  @Column({ type: 'text', nullable: true })
  currency: string | null;

  @Column({ type: 'text', nullable: true })
  stripe_charge_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  checkout_created_at: Date | null;

  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.NOT_PAID_OUT,
  })
  payout_status: PayoutStatus;

  @Column({ type: 'timestamp', nullable: true })
  paid_out_at: Date | null;

  @Column({ type: 'text', nullable: true })
  stripe_transfer_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  payout_attempted_at: Date | null;

  @Column({ type: 'text', nullable: true })
  payout_failure_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disputed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  dispute_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  learner_no_show_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  teacher_no_show_at: Date | null;
}
