import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createReview(@CurrentUser() user: { id: string }, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(user.id, dto);
  }

  @Get('teacher/:id')
  getReviews(@Param('id') teacherId: string) {
    return this.reviewsService.getReviewsForTeacher(teacherId);
  }

  @Get('teacher/:id/summary')
  getReviewSummary(@Param('id') teacherId: string) {
    return this.reviewsService.getReviewSummaryForTeacher(teacherId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('booking/:bookingId/eligibility')
  getReviewEligibility(
    @CurrentUser() user: { id: string },
    @Param('bookingId') bookingId: string,
  ) {
    return this.reviewsService.canLearnerReviewBooking(bookingId, user.id);
  }
}