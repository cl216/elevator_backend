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

@Entity('bookings')
@Index(['user', 'session'], { unique: true }) // ✅ prevents duplicate bookings
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

    // ✅ Add this
  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;
  
  @CreateDateColumn()
  createdAt: Date;

  // 1) Stripe Checkout Session ID (cs_test_...)
@Column({ type: 'text', nullable: true })
stripe_checkout_session_id: string | null;

// 2) Stripe PaymentIntent ID (pi_...)
@Column({ type: 'text', nullable: true })
stripe_payment_intent_id: string | null;

// 3) When payment was confirmed (from webhook)
@Column({ type: 'timestamp', nullable: true })
paid_at: Date | null;

// Amount and currency at time of purchase (don’t rely on session.price later)
@Column({ type: 'int', nullable: true })
amount: number | null;

@Column({ type: 'text', nullable: true })
currency: string | null;

// If you want a fully auditable flow:
@Column({ type: 'text', nullable: true })
stripe_charge_id: string | null; // sometimes useful later

// Helpful for “don’t create checkout twice” logic
@Column({ type: 'timestamp', nullable: true })
checkout_created_at: Date | null;
}
