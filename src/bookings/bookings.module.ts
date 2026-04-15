import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingRemindersService } from './booking-reminders.service';
import { Session } from '../sessions/entities/session.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PaymentsModule } from '../payments/payments.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Session, Notification]),
    forwardRef(() => PaymentsModule),
    EmailModule,
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingRemindersService],
  exports: [BookingsService],
})
export class BookingsModule {}