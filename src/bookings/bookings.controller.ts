import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  HttpCode, HttpStatus
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(
      user.id,
      dto.sessionId,
      dto.introMessage,
    );
  }

  @Get('me')
  getMyBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.getMyBookings(user.id);
  }

  @Get(':bookingId')
  getBookingById(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingsService.getBookingDetailsForLearner(
      bookingId,
      user.id,
    );
  }
@Post(':bookingId/cancel/learner')
@HttpCode(HttpStatus.OK)
cancelByLearner(
  @CurrentUser() user: { id: string },
  @Param('bookingId') bookingId: string,
) {
  return this.bookingsService.cancelBookingByLearner(bookingId, user.id);
}

@Post(':bookingId/cancel/teacher')
@HttpCode(HttpStatus.OK)
cancelByTeacher(
  @CurrentUser() user: { id: string },
  @Param('bookingId') bookingId: string,
) {
  return this.bookingsService.cancelBookingByTeacher(bookingId, user.id);
}
}