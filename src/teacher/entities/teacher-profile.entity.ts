import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';


@Entity('teacher_profiles')
export class TeacherProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  full_name: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'text', nullable: true })
stripe_account_id: string | null;

  @OneToOne(() => User, (u) => u.teacherProfile, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  User: User;
}
