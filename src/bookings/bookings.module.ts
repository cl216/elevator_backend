import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';
import { User } from '../users/user.entity';
import { BookingExpiryService } from './booking-expiry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Session, User])],
  controllers: [BookingsController],
  providers: [BookingsService, BookingExpiryService],
})
export class BookingsModule {}
