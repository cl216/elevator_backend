import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column()
  title: string;

  @Column()
  category: string;

@Column({ type: 'text', nullable: true })
description: string | null;

  @Column({ type: 'decimal' })
  price: number;

  @Column({ type: 'text', nullable: true })
  image_url_1: string | null;

  @Column({ type: 'text', nullable: true })
  image_url_2: string | null;

  @Column({ type: 'text', nullable: true })
  image_url_3: string | null;
}