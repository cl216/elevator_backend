import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { User } from './users/user.entity';
import { Class } from './classes/entities/class.entity';
import { Session } from './sessions/entities/session.entity';
import { Booking } from './bookings/entities/booking.entity';
import { TeacherProfile } from './teacher/entities/teacher-profile.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'classes_user',
  password: process.env.DB_PASS ?? 'classes_pass',
  database: process.env.DB_NAME ?? 'classes',

  entities: [User, Class, Session, Booking, TeacherProfile],
  migrations: ['src/migrations/*.ts'],

  synchronize: false,
  logging: false,
});

export default dataSource;