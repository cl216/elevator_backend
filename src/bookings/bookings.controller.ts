import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles('LEARNER')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(
      user.id,
      dto.sessionId,
      dto.introMessage,
    );
  }

  @Get('me')
  @Roles('LEARNER')
  getMyBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.getMyBookings(user.id);
  }
}
