import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherFollower } from './entities/teacher-follower.entity';
import { TeacherStripeService } from './teacher-stripe.service';
import { User } from '../users/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherProfile,
      TeacherFollower,
      User,
      Booking,
      Session,
    ]),
    ReviewsModule,
  ],
  providers: [TeacherService, TeacherStripeService],
  controllers: [TeacherController],
  exports: [TeacherService],
})
export class TeacherModule {}