import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('teacher_followers')
@Index('IDX_TEACHER_FOLLOWERS_TEACHER_ID', ['teacher_id'])
@Index('IDX_TEACHER_FOLLOWERS_USER_ID', ['user_id'])
export class TeacherFollower {
  @PrimaryColumn('uuid')
  teacher_id: string;

  @PrimaryColumn('uuid')
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
