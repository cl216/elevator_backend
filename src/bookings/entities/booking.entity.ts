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

export enum PayoutStatus {
  NOT_PAID_OUT = 'NOT_PAID_OUT',
  PAID_OUT = 'PAID_OUT',
  PAYOUT_FAILED = 'PAYOUT_FAILED',
}

@Entity('bookings')
@Index(['user', 'session'], { unique: true }) // prevents duplicate bookings
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
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';

  @Column({ type: 'text', nullable: true })
  intro_message: string | null;

  // Booking expiry (for pending payment window)
  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  // -------------------------------
  // Stripe Checkout / Payment Data
  // -------------------------------

  @Column({ type: 'text', nullable: true })
  stripe_checkout_session_id: string | null;

  @Column({ type: 'text', nullable: true })
  stripe_payment_intent_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  // Amount and currency at time of purchase
  @Column({ type: 'int', nullable: true })
  amount: number | null;

  @Column({ type: 'text', nullable: true })
  currency: string | null;

  @Column({ type: 'text', nullable: true })
  stripe_charge_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  checkout_created_at: Date | null;

  // -------------------------------
  // Delayed Payout Fields (Phase 5)
  // -------------------------------

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
}
