import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
} from 'typeorm';
import { TeacherProfile } from '../teacher/entities/teacher-profile.entity';

export type UserRole = 'LEARNER' | 'TEACHER';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ type: 'text', default: 'LEARNER' })
  role: UserRole;

  @Column({ type: 'text', nullable: true })
  first_name: string | null;

  @Column({ type: 'text', nullable: true })
image_url: string | null;

  @Column({ type: 'text', nullable: true })
  stripe_customer_id: string | null;

  @Column({ type: 'text', nullable: true })
  refresh_token_hash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  refresh_token_expires_at: Date | null;

  @Column({ type: 'text', nullable: true })
  password_reset_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  password_reset_expires_at: Date | null;

  @Column({ type: 'text', nullable: true })
  email_verification_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  email_verification_expires_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  email_verified_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  
  @OneToOne(() => TeacherProfile, (tp) => tp.user, { nullable: true })
  teacherProfile?: TeacherProfile;

  @Column({ type: 'boolean', default: false })
is_admin: boolean;
}