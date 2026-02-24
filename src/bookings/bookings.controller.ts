import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}
  // 1️⃣ Core booking endpoint
  @Post()
  @Roles('LEARNER')
  create(
    @CurrentUser() user: { id: string },
    @Body('sessionId') sessionId: string,
  ) {
    return this.bookingsService.createBooking(user.id, sessionId);
  }
  // 2️⃣ TEMP test endpoint
  @Get('me')
  @Roles('LEARNER') // optional: restrict to learners
  getMyBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.getMyBookings(user.id);
  }
}
