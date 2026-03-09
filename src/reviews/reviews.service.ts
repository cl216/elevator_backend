import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';

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

  async createReview(learnerId: string, dto: CreateReviewDto): Promise<Review> {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId },
      relations: ['session', 'session.teacher', 'user'],
    });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    if (booking.user.id !== learnerId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    const sessionEnd = new Date(booking.session.start_time);
    sessionEnd.setMinutes(sessionEnd.getMinutes() + booking.session.duration);

    if (new Date() < sessionEnd) {
      throw new BadRequestException('Cannot review session before it ends');
    }

    // Check if review already exists
    const existing = await this.reviewRepository.findOne({
      where: { booking: { id: booking.id } },
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this booking');
    }

    const review = this.reviewRepository.create({
      booking,
      teacher: booking.session.teacher,
      rating: dto.rating,
      comment: dto.comment,
    });

    return this.reviewRepository.save(review);
  }

  async getReviewsForTeacher(teacherId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { teacher: { id: teacherId } },
      relations: ['booking', 'booking.user'],
      order: { created_at: 'DESC' },
    });
  }
}
