import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingsModule } from '../bookings/bookings.module';
import { PayoutsService } from './payouts.service'; // ✅ add

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), BookingsModule],
  providers: [PaymentsService, PayoutsService], // ✅ add
  controllers: [PaymentsController],
})
export class PaymentsModule {}
