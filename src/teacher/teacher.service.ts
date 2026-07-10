import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherFollower } from './entities/teacher-follower.entity';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { User } from '../users/user.entity';
import { containsBlockedContactOrOffPlatformContent } from '../utils/content-moderation';
import { Booking } from '../bookings/entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';
import { ReviewsService } from '../reviews/reviews.service';
import { Repository, DataSource } from 'typeorm';

@Injectable()
export class TeacherService {
  constructor(
    private readonly dataSource: DataSource,
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

  async getTeacherAttentionSummary(teacherId: string) {
  const openPrivateRequests = await this.dataSource.query(
    `
    SELECT COUNT(*)::int AS count
    FROM private_session_requests
    WHERE teacher_id = $1
      AND status = 'OPEN'
    `,
    [teacherId],
  );

  const refundIssues = await this.dataSource.query(
    `
    SELECT COUNT(*)::int AS count
    FROM bookings b
    INNER JOIN sessions s ON s.id = b.session_id
    WHERE s.teacher_id = $1
      AND b.status = 'REFUND_FAILED'
    `,
    [teacherId],
  );

  const missingArrivalInstructions = await this.dataSource.query(
    `
    SELECT COUNT(DISTINCT s.id)::int AS count
    FROM sessions s
    INNER JOIN bookings b ON b.session_id = s.id
    WHERE s.teacher_id = $1
      AND b.status = 'CONFIRMED'
      AND s.start_time > NOW()
      AND (
        s.arrival_instructions IS NULL
        OR LENGTH(TRIM(s.arrival_instructions)) = 0
      )
    `,
    [teacherId],
  );

  const sessionsToday = await this.dataSource.query(
    `
    SELECT COUNT(*)::int AS count
    FROM sessions s
    WHERE s.teacher_id = $1
      AND s.status = 'ACTIVE'
      AND s.start_time >= NOW()
      AND s.start_time < NOW() + INTERVAL '24 hours'
    `,
    [teacherId],
  );



  const openPrivateRequestsCount = Number(openPrivateRequests?.[0]?.count ?? 0);
  const refundIssuesCount = Number(refundIssues?.[0]?.count ?? 0);
  const missingArrivalInstructionsCount = Number(
    missingArrivalInstructions?.[0]?.count ?? 0,
  );
  const sessionsTodayCount = Number(sessionsToday?.[0]?.count ?? 0);

  const items: any[] = [];

  if (openPrivateRequestsCount > 0) {
    items.push({
      type: 'private_requests',
      count: openPrivateRequestsCount,
      label:
        openPrivateRequestsCount === 1
          ? '1 private request waiting'
          : `${openPrivateRequestsCount} private requests waiting`,
      priority: 'high',
      route: '/(teacher)/private-session-requests',
      actionLabel: 'Review requests',
      countsTowardBadge: true,
    });
  }

  if (missingArrivalInstructionsCount > 0) {
    items.push({
      type: 'missing_arrival_instructions',
      count: missingArrivalInstructionsCount,
      label:
        missingArrivalInstructionsCount === 1
          ? '1 booked session needs arrival instructions'
          : `${missingArrivalInstructionsCount} booked sessions need arrival instructions`,
      priority: 'high',
      route: '/(teacher)/sessions',
      actionLabel: 'Update sessions',
      countsTowardBadge: true,
    });
  }

  if (refundIssuesCount > 0) {
    items.push({
      type: 'refund_issues',
      count: refundIssuesCount,
      label:
        refundIssuesCount === 1
          ? '1 refund issue needs attention'
          : `${refundIssuesCount} refund issues need attention`,
      priority: 'high',
      route: '/(teacher)/sessions',
      actionLabel: 'Review bookings',
      countsTowardBadge: true,
    });
  }

  if (sessionsTodayCount > 0) {
    items.push({
      type: 'sessions_today',
      count: sessionsTodayCount,
      label:
        sessionsTodayCount === 1
          ? '1 session coming up in the next 24 hours'
          : `${sessionsTodayCount} sessions coming up in the next 24 hours`,
      priority: 'medium',
      route: '/(teacher)/sessions',
      actionLabel: 'View sessions',
      countsTowardBadge: false,
    });
  }

  const totalActionItems = items
    .filter((item) => item.countsTowardBadge)
    .reduce((sum, item) => sum + item.count, 0);

  return {
    total_action_items: totalActionItems,
    items,
  };
}

async getPayoutSummary(teacherId: string) {
  const rows = await this.dataSource.query(
    `
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN b.payout_status = 'NOT_PAID_OUT'
              AND b.status IN (
                'CONFIRMED',
                'COMPLETED',
                'LEARNER_NO_SHOW',
                'LATE_CANCELLED_BY_LEARNER'
              )
            THEN COALESCE(
              b.teacher_payout_amount,
              b.lesson_amount,
              b.amount,
              0
            )
            ELSE 0
          END
        ),
        0
      )::bigint AS pending_amount,

      COUNT(
        CASE
          WHEN b.payout_status = 'NOT_PAID_OUT'
            AND b.status IN (
              'CONFIRMED',
              'COMPLETED',
              'LEARNER_NO_SHOW',
              'LATE_CANCELLED_BY_LEARNER'
            )
          THEN 1
        END
      )::int AS pending_count,

      MIN(
        CASE
          WHEN b.payout_status = 'NOT_PAID_OUT'
            AND b.status IN (
              'CONFIRMED',
              'COMPLETED',
              'LEARNER_NO_SHOW',
              'LATE_CANCELLED_BY_LEARNER'
            )
          THEN s.end_time + INTERVAL '24 hours'
          ELSE NULL
        END
      ) AS next_eligible_at,

      COALESCE(
        SUM(
          CASE
            WHEN b.payout_status = 'PAID_OUT'
            THEN COALESCE(
              b.teacher_payout_amount,
              b.lesson_amount,
              b.amount,
              0
            )
            ELSE 0
          END
        ),
        0
      )::bigint AS transferred_amount,

      COUNT(
        CASE
          WHEN b.payout_status = 'PAID_OUT'
          THEN 1
        END
      )::int AS transferred_count,

      COALESCE(
        SUM(
          CASE
            WHEN b.payout_status = 'PAYOUT_FAILED'
            THEN COALESCE(
              b.teacher_payout_amount,
              b.lesson_amount,
              b.amount,
              0
            )
            ELSE 0
          END
        ),
        0
      )::bigint AS failed_amount,

      COUNT(
        CASE
          WHEN b.payout_status = 'PAYOUT_FAILED'
          THEN 1
        END
      )::int AS failed_count

    FROM bookings b
    INNER JOIN sessions s
      ON s.id = b.session_id
    WHERE s.teacher_id = $1
    `,
    [teacherId],
  );

  const summary = rows?.[0] ?? {};

  return {
    pending_amount: Number(summary.pending_amount ?? 0),
    pending_count: Number(summary.pending_count ?? 0),

    next_eligible_at: summary.next_eligible_at
      ? new Date(summary.next_eligible_at).toISOString()
      : null,

    transferred_amount: Number(summary.transferred_amount ?? 0),
    transferred_count: Number(summary.transferred_count ?? 0),

    failed_amount: Number(summary.failed_amount ?? 0),
    failed_count: Number(summary.failed_count ?? 0),

    currency: 'eur',
  };
}

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

  const gallery = Array.isArray(dto.gallery_image_urls)
    ? dto.gallery_image_urls.map((item) => item?.trim()).filter(Boolean)
    : [];

  const image_url_1 = dto.image_url_1?.trim() || gallery[0] || null;
  const image_url_2 = dto.image_url_2?.trim() || gallery[1] || null;
  const image_url_3 = dto.image_url_3?.trim() || gallery[2] || null;

  if (existingProfile) {
    existingProfile.full_name = full_name;
    existingProfile.display_name = full_name;
    existingProfile.bio = bio;
    existingProfile.image_url = image_url;
    existingProfile.image_url_1 = image_url_1;
    existingProfile.image_url_2 = image_url_2;
    existingProfile.image_url_3 = image_url_3;

    const savedProfile = await this.profileRepo.save(existingProfile);

    await this.userRepo.update({ id: user.id }, { role: 'TEACHER' });

    return savedProfile;
  }

  const profile = this.profileRepo.create({
    full_name,
      display_name: full_name,
    bio,
    image_url,
    image_url_1,
    image_url_2,
    image_url_3,
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
    relations: ['teacher', 'class'],
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
    .leftJoin('booking.user', 'learner')
    .select([
      'booking.id AS id',
      'booking.status AS status',
      'booking.intro_message AS intro_message',
      'booking.createdAt AS created_at',
      'learner.id AS learner_id',
      'learner.first_name AS learner_first_name',
    ])
    .where('booking.session_id = :sessionId', { sessionId })
    .orderBy('booking.createdAt', 'DESC')
    .getRawMany();

  return {
    session: {
      id: session.id,
      title: session.class?.title ?? 'Session',
      start_time: session.start_time,
      duration: session.duration,
      max_participants: session.max_participants,
      price: Number(session.price),
      arrival_instructions: session.arrival_instructions ?? null,
    },
    bookings,
  };
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
  image_urls: [
    teacher.teacherProfile.image_url_1,
    teacher.teacherProfile.image_url_2,
    teacher.teacherProfile.image_url_3,
  ].filter(Boolean),
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
  image_urls: [
    profile.image_url_1,
    profile.image_url_2,
    profile.image_url_3,
  ].filter(Boolean),
  image_url_1: profile.image_url_1,
  image_url_2: profile.image_url_2,
  image_url_3: profile.image_url_3,
};
  }
}