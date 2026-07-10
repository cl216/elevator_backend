import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { User } from '../users/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,

    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createReview(
    learnerId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId },
      relations: ['session', 'session.teacher', 'user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.user.id !== learnerId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed bookings can be reviewed');
    }

    const sessionEnd = booking.session?.end_time
      ? new Date(booking.session.end_time)
      : null;

    if (!sessionEnd || Number.isNaN(sessionEnd.getTime())) {
      throw new BadRequestException('Session end time is invalid');
    }

    if (Date.now() < sessionEnd.getTime()) {
      throw new BadRequestException(
        'Cannot review a session before it has finished',
      );
    }

    const existing = await this.reviewRepository.findOne({
      where: { booking: { id: booking.id } },
      relations: ['booking'],
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this booking');
    }

    const learner = await this.usersRepository.findOne({
      where: { id: learnerId },
    });

    if (!learner) {
      throw new NotFoundException('Learner not found');
    }

    const review = this.reviewRepository.create({
      booking,
      teacher: booking.session.teacher,
      learner,
      rating: dto.rating,
      comment: dto.comment?.trim() || null,
    });

    return this.reviewRepository.save(review);
  }

  async getReviewsForTeacher(teacherId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { teacher: { id: teacherId } },
      relations: ['booking', 'learner'],
      order: { created_at: 'DESC' },
    });
  }

  async getReviewSummaryForTeacher(teacherId: string) {
    const raw = await this.reviewRepository
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'reviewCount')
      .addSelect('AVG(review.rating)', 'averageRating')
      .where('review.teacher_id = :teacherId', { teacherId })
      .getRawOne();

    const reviewCount = Number(raw?.reviewCount ?? 0);
    const averageRating =
      raw?.averageRating !== null && raw?.averageRating !== undefined
        ? Number(raw.averageRating)
        : null;

    return {
      review_count: reviewCount,
      average_rating:
        averageRating !== null && Number.isFinite(averageRating)
          ? Number(averageRating.toFixed(1))
          : null,
    };
  }

  async canLearnerReviewBooking(bookingId: string, learnerId: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['session', 'user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.user.id !== learnerId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    const existing = await this.reviewRepository.findOne({
      where: { booking: { id: booking.id } },
      relations: ['booking'],
    });

    const sessionEnd = booking.session?.end_time
      ? new Date(booking.session.end_time)
      : null;

    const hasFinished =
      !!sessionEnd &&
      !Number.isNaN(sessionEnd.getTime()) &&
      sessionEnd.getTime() <= Date.now();

    const eligible =
      booking.status === BookingStatus.CONFIRMED && hasFinished && !existing;

    return {
      eligible,
      reason: eligible
        ? null
        : existing
          ? 'already_reviewed'
          : booking.status !== BookingStatus.CONFIRMED
            ? 'booking_not_confirmed'
            : !hasFinished
              ? 'session_not_finished'
              : 'not_eligible',
    };
  }
}
