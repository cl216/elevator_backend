import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';
import { Class } from '../classes/entities/class.entity';
import { ClassRequest } from '../class-requests/class-request.entity';
import { TeacherProfile } from '../teacher/entities/teacher-profile.entity';

import { PaymentsModule } from '../payments/payments.module';
import { SessionsModule } from '../sessions/session.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Category,
      Booking,
      Session,
      Class,
      ClassRequest,
      TeacherProfile,
    ]),
    PaymentsModule,
    SessionsModule,
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}