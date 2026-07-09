import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { SessionsService } from '../sessions/sessions.service';
import {
  Booking,
  BookingStatus,
} from '../bookings/entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';
import { Class } from '../classes/entities/class.entity';
import { ClassRequest } from '../class-requests/class-request.entity';
import { TeacherProfile } from '../teacher/entities/teacher-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,

    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,

    @InjectRepository(ClassRequest)
    private readonly classRequestsRepository: Repository<ClassRequest>,

    @InjectRepository(TeacherProfile)
    private readonly teacherProfilesRepository: Repository<TeacherProfile>,

    private readonly paymentsService: PaymentsService,
    private readonly sessionsService: SessionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getUsers() {
    return this.usersRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async suspendUser(userId: string) {
    await this.usersRepository.update(userId, { is_suspended: true });
    return { success: true };
  }

  async unsuspendUser(userId: string) {
    await this.usersRepository.update(userId, { is_suspended: false });
    return { success: true };
  }

  async getPendingCategories() {
    return this.categoriesRepository.find({
      where: { status: 'pending' as any },
      order: { created_at: 'DESC' },
      relations: { created_by: true } as any,
    });
  }

async approveCategory(id: string) {
  const category = await this.categoriesRepository.findOne({
    where: { id },
    relations: { created_by: true } as any,
  });

  if (!category) {
    throw new NotFoundException('Category not found');
  }

  category.status = 'approved' as any;
  await this.categoriesRepository.save(category);

  if (category.created_by?.id) {
    await this.notificationsService.create({
      user_id: category.created_by.id,
      type: 'CATEGORY_APPROVED',
      title: 'Category approved',
      body: `Your category "${category.label}" has been approved and is now live.`,
      payload: {
        category_id: category.id,
        status: 'approved',
      },
    });
  }

  return { success: true };
}

async rejectCategory(id: string) {
  const category = await this.categoriesRepository.findOne({
    where: { id },
    relations: { created_by: true } as any,
  });

  if (!category) {
    throw new NotFoundException('Category not found');
  }

  category.status = 'rejected' as any;
  await this.categoriesRepository.save(category);

  if (category.created_by?.id) {
    await this.notificationsService.create({
      user_id: category.created_by.id,
      type: 'CATEGORY_REJECTED',
      title: 'Category not approved',
      body: `Your category "${category.label}" was not approved.`,
      payload: {
        category_id: category.id,
        status: 'rejected',
      },
    });
  }

  return { success: true };
}

  async getBookings() {
    return this.bookingsRepository.find({
      relations: {
        user: true,
        session: {
          teacher: true,
          class: true,
        },
      } as any,
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingReviewSessions() {
    return this.sessionsRepository.find({
      where: { reviewStatus: 'PENDING_REVIEW' } as any,
      relations: {
        teacher: true,
        class: true,
      } as any,
      order: { start_time: 'DESC' },
    });
  }

async approveSession(id: string) {
  return this.sessionsService.approveSessionForReview(id);
}

async rejectSession(id: string) {
  return this.sessionsService.rejectSessionForReview(id);
}

  async getClassRequests() {
    return this.classRequestsRepository.find({
      where: { review_status: 'pending' },
      relations: { user: true } as any,
      order: { created_at: 'DESC' },
    });
  }

  async approveClassRequest(id: string) {
    await this.classRequestsRepository.update(id, {
      review_status: 'approved',
    });

    return { success: true };
  }

  async rejectClassRequest(id: string) {
    await this.classRequestsRepository.update(id, {
      review_status: 'rejected',
    });

    return { success: true };
  }

  async getModerationImages() {
    const users = await this.usersRepository.find({
      where: {} as any,
      order: { created_at: 'DESC' },
    });

    const teacherProfiles = await this.teacherProfilesRepository.find({
      relations: { user: true } as any,
    });

    const classes = await this.classesRepository.find({
      relations: { teacher: true } as any,
    });

    const images: any[] = [];

    for (const user of users) {
      if (user.image_url) {
        images.push({
          id: `user:${user.id}:image_url`,
          source_type: 'user',
          source_id: user.id,
          field: 'image_url',
          image_url: user.image_url,
          owner_email: user.email,
          title: user.first_name || user.email,
          context: 'User profile image',
        });
      }
    }

    for (const profile of teacherProfiles) {
      const fields = [
        'image_url',
        'image_url_1',
        'image_url_2',
        'image_url_3',
      ] as const;

      for (const field of fields) {
        const imageUrl = profile[field];

        if (imageUrl) {
          images.push({
            id: `teacher_profile:${profile.id}:${field}`,
            source_type: 'teacher_profile',
            source_id: profile.id,
            field,
            image_url: imageUrl,
            owner_email: profile.user?.email ?? null,
            title: profile.full_name,
            context: `Teacher profile ${field}`,
          });
        }
      }
    }

    for (const classRow of classes) {
      const fields = ['image_url_1', 'image_url_2', 'image_url_3'] as const;

      for (const field of fields) {
        const imageUrl = classRow[field];

        if (imageUrl) {
          images.push({
            id: `class:${classRow.id}:${field}`,
            source_type: 'class',
            source_id: classRow.id,
            field,
            image_url: imageUrl,
            owner_email: classRow.teacher?.email ?? null,
            title: classRow.title,
            context: `Class image ${field}`,
          });
        }
      }
    }

    return images;
  }

  async removeModerationImage(body: {
    source_type: 'user' | 'teacher_profile' | 'class';
    source_id: string;
    field: string;
  }) {
    const { source_type, source_id, field } = body;

    if (!source_type || !source_id || !field) {
      throw new BadRequestException('Missing image moderation fields');
    }

    if (source_type === 'user') {
      if (field !== 'image_url') {
        throw new BadRequestException('Invalid user image field');
      }

      const result = await this.usersRepository.update(source_id, {
        image_url: null,
      });

      if (!result.affected) {
        throw new NotFoundException('User not found');
      }

      return { success: true };
    }

    if (source_type === 'teacher_profile') {
      const allowed = [
        'image_url',
        'image_url_1',
        'image_url_2',
        'image_url_3',
      ];

      if (!allowed.includes(field)) {
        throw new BadRequestException('Invalid teacher profile image field');
      }

      const result = await this.teacherProfilesRepository.update(source_id, {
        [field]: null,
      } as any);

      if (!result.affected) {
        throw new NotFoundException('Teacher profile not found');
      }

      return { success: true };
    }

    if (source_type === 'class') {
      const allowed = ['image_url_1', 'image_url_2', 'image_url_3'];

      if (!allowed.includes(field)) {
        throw new BadRequestException('Invalid class image field');
      }

      const result = await this.classesRepository.update(source_id, {
        [field]: null,
      } as any);

      if (!result.affected) {
        throw new NotFoundException('Class not found');
      }

      return { success: true };
    }

    throw new BadRequestException('Invalid image source type');
  }
    async getDisputedBookings() {
    return this.bookingsRepository.find({
      where: {
        status: BookingStatus.DISPUTED,
      } as any,
      relations: {
        user: true,
        session: {
          teacher: true,
          class: true,
        },
      } as any,
      order: {
        disputed_at: 'DESC',
      } as any,
    });
  }

  async approveLearnerNoShow(id: string) {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    booking.status = BookingStatus.LEARNER_NO_SHOW;

    await this.bookingsRepository.save(booking);

    return {
      success: true,
    };
  }

  async approveTeacherNoShow(id: string) {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    booking.status = BookingStatus.REFUND_PENDING;

    await this.bookingsRepository.save(booking);

    await this.paymentsService.createRefundForBooking(id);

    return {
      success: true,
    };
  }

  async markBookingCompleted(id: string) {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    booking.status = BookingStatus.COMPLETED;
    booking.completed_at = new Date();

    await this.bookingsRepository.save(booking);

    return {
      success: true,
    };
  }

  async rejectDispute(id: string) {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    booking.status = BookingStatus.COMPLETED;
    booking.completed_at = new Date();

    await this.bookingsRepository.save(booking);

    return {
      success: true,
    };
  }
}