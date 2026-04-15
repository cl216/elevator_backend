import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('class_requests')
export class ClassRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 30,
  })
  request_type: 'existing_category' | 'new_class';

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  custom_title: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  review_status: 'pending' | 'approved' | 'rejected';

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}