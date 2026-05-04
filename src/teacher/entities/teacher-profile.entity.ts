import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('teacher_profiles')
export class TeacherProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  full_name: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  image_url: string | null;

  @Column({ type: 'text', nullable: true })
  stripe_account_id: string | null;

  @Column({ default: false })
  stripe_enabled: boolean;

  @Column({ type: "text", nullable: true })
image_url_1: string | null;

@Column({ type: "text", nullable: true })
image_url_2: string | null;

@Column({ type: "text", nullable: true })
image_url_3: string | null;

@Column({ type: "text" })
display_name: string;
}