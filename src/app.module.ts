import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TeacherModule } from './teacher/teacher.module'; 
import { ClassesModule } from './classes/classes.module';
import { SessionsModule } from './sessions/session.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
    TeacherModule,
    ClassesModule,
    SessionsModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    ScheduleModule.forRoot(),
    // Postgres + TypeORM setup
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,   // automatically loads entities from forFeature
      synchronize: true,        // only for dev, creates tables automatically
    }),

    UsersModule,
    AuthModule,
    ReviewsModule,
  ],
})
export class AppModule {}
