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

  @Column({ type: 'text' })
  role: UserRole;

  @Column({ type: 'text', nullable: true })
  first_name: string | null;

  @CreateDateColumn()
  created_at: Date;

  @OneToOne(() => TeacherProfile, (tp) => tp.user, { nullable: true })
  teacherProfile?: TeacherProfile;
}
