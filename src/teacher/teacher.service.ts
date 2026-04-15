import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherFollower } from './entities/teacher-follower.entity';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { User } from '../users/user.entity';
import { containsBlockedContactOrOffPlatformContent } from '../utils/content-moderation';
import { Booking } from '../bookings/entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';
import { ReviewsService } from '../reviews/reviews.service';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(TeacherProfile)
    private profileRepo: Repository<TeacherProfile>,

    @InjectRepository(TeacherFollower)
    private teacherFollowerRepo: Repository<TeacherFollower>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,

    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,

    private readonly reviewsService: ReviewsService,
  ) {}

  async createProfile(user: User, dto: CreateTeacherProfileDto) {
    if (dto.bio && containsBlockedContactOrOffPlatformContent(dto.bio)) {
      throw new BadRequestException(
        'Please keep communication on the platform. Do not include phone numbers, email addresses, social handles, or external sites in your bio.',
      );
    }

    const existingProfile = await this.profileRepo.findOne({
      where: {
        user: { id: user.id },
      } as any,
      relations: ['user'],
    });

    const full_name = dto.full_name.trim();
    const bio = dto.bio?.trim() || null;
    const image_url = dto.image_url?.trim() || null;

    if (existingProfile) {
      existingProfile.full_name = full_name;
      existingProfile.bio = bio;
      existingProfile.image_url = image_url;

      const savedProfile = await this.profileRepo.save(existingProfile);

      await this.userRepo.update({ id: user.id }, { role: 'TEACHER' });

      return savedProfile;
    }

    const profile = this.profileRepo.create({
      full_name,
      bio,
      image_url,
      user: { id: user.id } as User,
    });

    const savedProfile = await this.profileRepo.save(profile);

    await this.userRepo.update({ id: user.id }, { role: 'TEACHER' });

    return savedProfile;
  }

  async followTeacher(currentUserId: string, teacherId: string) {
    if (currentUserId === teacherId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const teacher = await this.userRepo.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new NotFoundException('Teacher not found');
    }

    const existingFollow = await this.teacherFollowerRepo.findOne({
      where: {
        teacher_id: teacherId,
        user_id: currentUserId,
      },
    });

    if (existingFollow) {
      return { message: 'Already following this teacher' };
    }

    const follow = this.teacherFollowerRepo.create({
      teacher_id: teacherId,
      user_id: currentUserId,
    });

    await this.teacherFollowerRepo.save(follow);

    return { message: 'Teacher followed successfully' };
  }

  async unfollowTeacher(currentUserId: string, teacherId: string) {
    const existingFollow = await this.teacherFollowerRepo.findOne({
      where: {
        teacher_id: teacherId,
        user_id: currentUserId,
      },
    });

    if (!existingFollow) {
      return { message: 'You are not following this teacher' };
    }

    await this.teacherFollowerRepo.delete({
      teacher_id: teacherId,
      user_id: currentUserId,
    });

    return { message: 'Teacher unfollowed successfully' };
  }

  async getFollowing(currentUserId: string) {
    return this.teacherFollowerRepo
      .createQueryBuilder('follow')
      .leftJoinAndSelect('follow.teacher', 'teacher')
      .leftJoinAndSelect('teacher.teacherProfile', 'profile')
      .where('follow.user_id = :userId', { userId: currentUserId })
      .orderBy('follow.created_at', 'DESC')
      .getMany();
  }

  async getFollowStatus(currentUserId: string, teacherId: string) {
    const existingFollow = await this.teacherFollowerRepo.findOne({
      where: {
        teacher_id: teacherId,
        user_id: currentUserId,
      },
    });

    return {
      following: !!existingFollow,
    };
  }

  async getSessionBookingsForTeacher(sessionId: string, teacherId: string) {
    const teacher = await this.userRepo.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['teacher'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.teacher.id !== teacherId) {
      throw new ForbiddenException(
        'You can only view bookings for your own sessions',
      );
    }

    const bookings = await this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'learner')
      .leftJoinAndSelect('booking.session', 'session')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ['PENDING', 'CONFIRMED'],
      })
      .orderBy('booking.createdAt', 'DESC')
      .getMany();

    const learnerIds = [...new Set(bookings.map((b) => b.user.id))];

    let completedCounts = new Map<string, number>();

    if (learnerIds.length > 0) {
      const rawCounts = await this.bookingRepo
        .createQueryBuilder('booking')
        .leftJoin('booking.user', 'learner')
        .select('learner.id', 'learnerId')
        .addSelect('COUNT(booking.id)', 'completedCount')
        .where('learner.id IN (:...learnerIds)', { learnerIds })
        .andWhere('booking.status = :status', { status: 'CONFIRMED' })
        .groupBy('learner.id')
        .getRawMany();

      completedCounts = new Map(
        rawCounts.map((row) => [row.learnerId, Number(row.completedCount)]),
      );
    }

    return bookings.map((booking) => ({
      bookingId: booking.id,
      status: booking.status,
      introMessage: booking.intro_message ?? null,
      createdAt: booking.createdAt,
      learner: {
        id: booking.user.id,
        firstName: booking.user.first_name ?? 'Learner',
        memberSince: booking.user.created_at,
        completedBookingsCount: completedCounts.get(booking.user.id) ?? 0,
      },
    }));
  }

  async getPublicTeacherProfile(teacherId: string) {
    const teacher = await this.userRepo.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new NotFoundException('Teacher profile not found');
    }

    const reviewSummary =
      await this.reviewsService.getReviewSummaryForTeacher(teacherId);

    return {
      id: teacher.id,
      full_name: teacher.teacherProfile.full_name,
      bio: teacher.teacherProfile.bio ?? null,
      image_url: teacher.teacherProfile.image_url ?? null,
      joined_at: teacher.created_at,
      average_rating: reviewSummary.average_rating,
      review_count: reviewSummary.review_count,
    };
  }

  async getMyProfile(userId: string) {
    const profile = await this.profileRepo.findOne({
      where: {
        user: { id: userId },
      } as any,
      relations: ['user'],
    });

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      full_name: profile.full_name,
      bio: profile.bio,
      image_url: profile.image_url,
    };
  }
}