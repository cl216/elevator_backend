import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session } from './entities/session.entity';
import { Class } from '../classes/entities/class.entity';
import { User } from '../users/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PrivateSessionRequestsModule } from '../private-lessons/private-lessons.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Class, User, Booking]),
    forwardRef(() => PrivateSessionRequestsModule),
    NotificationsModule,
  ],
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}