import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Param,
  HttpCode,
  HttpStatus,
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

  /**
   * Teacher reports that learner did not show.
   * No automatic refund.
   * Booking can still be paid out later.
   */
  @Post(':bookingId/no-show/learner')
  @HttpCode(HttpStatus.OK)
  markLearnerNoShow(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingsService.markLearnerNoShow(bookingId, user.id);
  }

  /**
   * Learner reports that teacher did not show.
   * Starts refund flow.
   */
  @Post(':bookingId/no-show/teacher')
  @HttpCode(HttpStatus.OK)
  markTeacherNoShow(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingsService.markTeacherNoShow(bookingId, user.id);
  }

  /**
   * Learner disputes a completed/confirmed booking.
   * Blocks payout until admin resolves.
   */
  @Post(':bookingId/dispute')
  @HttpCode(HttpStatus.OK)
  disputeBooking(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
    @Body() body: { reason?: string },
  ) {
    return this.bookingsService.disputeBooking(
      bookingId,
      user.id,
      body?.reason,
    );
  }
}