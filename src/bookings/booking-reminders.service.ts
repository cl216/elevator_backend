import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, Brackets } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { EmailService } from '../email/email.service';
import { BookingEmailBuilder } from '../email/builders/booking-email.builder';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { Review } from '../reviews/entities/review.entity';

type BookingWithRelations = Booking & {
  user: any;
  session: any;
};

type ReminderVariant = '24h' | '1h';

@Injectable()
export class BookingRemindersService {
  private readonly logger = new Logger(BookingRemindersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly bookingEmailBuilder: BookingEmailBuilder,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Cron('*/15 * * * *')
  async processReminders() {
    const startedAt = Date.now();

    this.logger.log('BOOKING_REMINDERS_CRON_STARTED');

    try {
      const reminders24h = await this.findDueBookings('24h');
      this.logger.log(
        `BOOKING_REMINDER_24H_DUE_FOUND count=${reminders24h.length}`,
      );

      for (const booking of reminders24h) {
        try {
          await this.sendReminderForBooking(
            booking as BookingWithRelations,
            '24h',
          );
        } catch (error: any) {
          this.logger.error(
            `BOOKING_REMINDER_24H_ITEM_FAILED bookingId=${booking.id} message=${error?.message ?? 'unknown'}`,
            error?.stack,
          );
        }
      }

      const reminders1h = await this.findDueBookings('1h');
      this.logger.log(
        `BOOKING_REMINDER_1H_DUE_FOUND count=${reminders1h.length}`,
      );

      for (const booking of reminders1h) {
        try {
          await this.sendReminderForBooking(
            booking as BookingWithRelations,
            '1h',
          );
        } catch (error: any) {
          this.logger.error(
            `BOOKING_REMINDER_1H_ITEM_FAILED bookingId=${booking.id} message=${error?.message ?? 'unknown'}`,
            error?.stack,
          );
        }
      }

      const reviewReminders = await this.findDueReviewReminderBookings();
      this.logger.log(
        `BOOKING_REVIEW_REMINDER_DUE_FOUND count=${reviewReminders.length}`,
      );

      for (const booking of reviewReminders) {
        try {
          await this.sendReviewReminderForBooking(
            booking as BookingWithRelations,
          );
        } catch (error: any) {
          this.logger.error(
            `BOOKING_REVIEW_REMINDER_ITEM_FAILED bookingId=${booking.id} message=${error?.message ?? 'unknown'}`,
            error?.stack,
          );
        }
      }

      const durationMs = Date.now() - startedAt;

      this.logger.log(
        `BOOKING_REMINDERS_CRON_COMPLETED count24h=${reminders24h.length} count1h=${reminders1h.length} countReview=${reviewReminders.length} durationMs=${durationMs}`,
      );
    } catch (error: any) {
      const durationMs = Date.now() - startedAt;

      this.logger.error(
        `BOOKING_REMINDERS_CRON_FAILED durationMs=${durationMs} message=${error?.message ?? 'unknown'}`,
        error?.stack,
      );

      throw error;
    }
  }

  private async findDueBookings(variant: ReminderVariant) {
    const now = new Date();

    const [windowStart, windowEnd] =
      variant === '24h'
        ? [
            new Date(now.getTime() + 23 * 60 * 60 * 1000),
            new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
          ]
        : [
            new Date(now.getTime() + 45 * 60 * 1000),
            new Date(now.getTime() + 60 * 60 * 1000 + 15 * 60 * 1000),
          ];

    const qb = this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.session', 'session')
      .leftJoinAndSelect('session.class', 'class')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .where('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('session.start_time BETWEEN :windowStart AND :windowEnd', {
        windowStart,
        windowEnd,
      });

    if (variant === '24h') {
      qb.andWhere('booking.reminder_24h_sent_at IS NULL').andWhere(
        new Brackets((subQb) => {
          subQb
            .where('booking.reminder_24h_failed_at IS NULL')
            .orWhere('booking.reminder_24h_failed_at < :retryCutoff24h', {
              retryCutoff24h: new Date(now.getTime() - 15 * 60 * 1000),
            });
        }),
      );
    } else {
      qb.andWhere('booking.reminder_1h_sent_at IS NULL').andWhere(
        new Brackets((subQb) => {
          subQb
            .where('booking.reminder_1h_failed_at IS NULL')
            .orWhere('booking.reminder_1h_failed_at < :retryCutoff1h', {
              retryCutoff1h: new Date(now.getTime() - 15 * 60 * 1000),
            });
        }),
      );
    }

    return qb.take(100).getMany();
  }

  private async findDueReviewReminderBookings() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (2 * 60 + 15) * 60 * 1000);
    const windowEnd = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    return this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.session', 'session')
      .leftJoinAndSelect('session.class', 'class')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .where('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('booking.review_reminder_sent_at IS NULL')
      .andWhere(
        new Brackets((subQb) => {
          subQb
            .where('booking.review_reminder_failed_at IS NULL')
            .orWhere('booking.review_reminder_failed_at < :retryCutoff', {
              retryCutoff: new Date(now.getTime() - 15 * 60 * 1000),
            });
        }),
      )
      .andWhere(
        new Brackets((subQb) => {
          subQb
            .where('session.end_time BETWEEN :windowStart AND :windowEnd', {
              windowStart,
              windowEnd,
            })
            .orWhere(
              `
              (
                session.end_time IS NULL
                AND session.start_time IS NOT NULL
                AND (session.start_time + ((COALESCE(session.duration, 0))::text || ' minutes')::interval)
                  BETWEEN :windowStart AND :windowEnd
              )
              `,
              { windowStart, windowEnd },
            );
        }),
      )
      .take(100)
      .getMany();
  }

  private async sendReminderForBooking(
    booking: BookingWithRelations,
    variant: ReminderVariant,
  ) {
    const bookingRepo = this.dataSource.getRepository(Booking);
    const notificationRepo = this.dataSource.getRepository(Notification);

    const freshBooking = await bookingRepo.findOne({
      where: { id: booking.id },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!freshBooking) return;
    if (freshBooking.status !== BookingStatus.CONFIRMED) return;

    if (variant === '24h' && freshBooking.reminder_24h_sent_at) {
      this.logger.log(
        `BOOKING_REMINDER_24H_ALREADY_SENT bookingId=${freshBooking.id}`,
      );
      return;
    }

    if (variant === '1h' && freshBooking.reminder_1h_sent_at) {
      this.logger.log(
        `BOOKING_REMINDER_1H_ALREADY_SENT bookingId=${freshBooking.id}`,
      );
      return;
    }

    const sessionTitle = freshBooking.session?.class?.title ?? 'your session';
    const teacherName = this.getTeacherDisplayName(
      freshBooking.session?.teacher,
    );
    const learnerName = this.getFirstName(freshBooking.user);
    const startAtLabel = this.formatSessionDate(
      freshBooking.session?.start_time,
    );
    const locationText = this.formatLocationText(freshBooking.session);

    const learnerTitle =
      variant === '24h' ? 'Session reminder' : 'Session starts soon';
    const learnerBody =
      variant === '24h'
        ? `${sessionTitle} starts in about 24 hours.`
        : `${sessionTitle} starts in about 1 hour.`;
    const learnerType =
      variant === '24h' ? 'session_reminder_24h' : 'session_reminder_1h';

    const teacherTitle =
      variant === '24h' ? 'Upcoming learner booking' : 'Learner arriving soon';
    const teacherBody =
      variant === '24h'
        ? `${learnerName} is booked for ${sessionTitle} in about 24 hours.`
        : `${learnerName} is booked for ${sessionTitle} in about 1 hour.`;
    const teacherType =
      variant === '24h'
        ? 'teacher_session_reminder_24h'
        : 'teacher_session_reminder_1h';

    try {
      await notificationRepo.save(
        notificationRepo.create({
          user_id: freshBooking.user.id,
          type: learnerType,
          title: learnerTitle,
          body: learnerBody,
          payload: {
            booking_id: freshBooking.id,
            session_id: freshBooking.session?.id,
            class_title: sessionTitle,
            teacher_name: teacherName,
            reminder_variant: variant,
            audience: 'learner',
          },
        }),
      );

      if (freshBooking.session?.teacher?.id) {
        await notificationRepo.save(
          notificationRepo.create({
            user_id: freshBooking.session.teacher.id,
            type: teacherType,
            title: teacherTitle,
            body: teacherBody,
            payload: {
              booking_id: freshBooking.id,
              session_id: freshBooking.session?.id,
              class_title: sessionTitle,
              learner_name: learnerName,
              reminder_variant: variant,
              audience: 'teacher',
            },
          }),
        );
      }

      await this.pushNotificationsService.sendToUser(freshBooking.user.id, {
        title: learnerTitle,
        body: learnerBody,
        data: {
          type: learnerType,
          booking_id: freshBooking.id,
          session_id: freshBooking.session?.id,
          class_title: sessionTitle,
          teacher_name: teacherName,
          reminder_variant: variant,
          audience: 'learner',
        },
      });

      if (freshBooking.session?.teacher?.id) {
        await this.pushNotificationsService.sendToUser(
          freshBooking.session.teacher.id,
          {
            title: teacherTitle,
            body: teacherBody,
            data: {
              type: teacherType,
              booking_id: freshBooking.id,
              session_id: freshBooking.session?.id,
              class_title: sessionTitle,
              learner_name: learnerName,
              reminder_variant: variant,
              audience: 'teacher',
            },
          },
        );
      }

      const learnerEmail = freshBooking.user?.email;
      if (learnerEmail) {
        const email = await this.bookingEmailBuilder.buildSessionReminder({
          to: learnerEmail,
          recipientFirstName: this.getFirstName(freshBooking.user),
          sessionTitle,
          teacherName,
          startAtLabel,
          locationText,
          bookingId: freshBooking.id,
          variant,
        });

        await this.emailService.send(email);
      } else {
        this.logger.warn(
          `BOOKING_REMINDER_EMAIL_SKIPPED_NO_LEARNER_EMAIL bookingId=${freshBooking.id} variant=${variant}`,
        );
      }

      if (variant === '24h') {
        freshBooking.reminder_24h_sent_at = new Date();
        freshBooking.reminder_24h_failed_at = null;
      } else {
        freshBooking.reminder_1h_sent_at = new Date();
        freshBooking.reminder_1h_failed_at = null;
      }

      await bookingRepo.save(freshBooking);

      this.logger.log(
        `BOOKING_REMINDER_SENT bookingId=${freshBooking.id} variant=${variant}`,
      );
    } catch (error: any) {
      if (variant === '24h') {
        freshBooking.reminder_24h_failed_at = new Date();
      } else {
        freshBooking.reminder_1h_failed_at = new Date();
      }

      await bookingRepo.save(freshBooking);

      this.logger.error(
        `BOOKING_REMINDER_FAILED bookingId=${freshBooking.id} variant=${variant} message=${error?.message ?? 'unknown'}`,
        error?.stack,
      );

      throw error;
    }
  }

  private async sendReviewReminderForBooking(booking: BookingWithRelations) {
    const bookingRepo = this.dataSource.getRepository(Booking);
    const notificationRepo = this.dataSource.getRepository(Notification);
    const reviewRepo = this.dataSource.getRepository(Review);

    const freshBooking = await bookingRepo.findOne({
      where: { id: booking.id },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!freshBooking) return;
    if (freshBooking.status !== BookingStatus.CONFIRMED) return;

    if (freshBooking.review_reminder_sent_at) {
      this.logger.log(
        `BOOKING_REVIEW_REMINDER_ALREADY_SENT bookingId=${freshBooking.id}`,
      );
      return;
    }

    const existingReview = await reviewRepo.findOne({
      where: {
        booking: { id: freshBooking.id },
      } as any,
      relations: ['booking'],
    });

    if (existingReview) {
      this.logger.log(
        `BOOKING_REVIEW_REMINDER_SKIPPED_ALREADY_REVIEWED bookingId=${freshBooking.id}`,
      );
      return;
    }

    const sessionTitle = freshBooking.session?.class?.title ?? 'your session';
    const teacherName = this.getTeacherDisplayName(
      freshBooking.session?.teacher,
    );

    const title = 'How was your class?';
    const body = `How was ${sessionTitle}? Leave a quick review for ${teacherName}.`;

    try {
      await notificationRepo.save(
        notificationRepo.create({
          user_id: freshBooking.user.id,
          type: 'review_reminder',
          title,
          body,
          payload: {
            type: 'review_reminder',
            booking_id: freshBooking.id,
            session_id: freshBooking.session?.id,
            class_title: sessionTitle,
            teacher_name: teacherName,
            audience: 'learner',
          },
        }),
      );

      await this.pushNotificationsService.sendToUser(freshBooking.user.id, {
        title,
        body,
        data: {
          type: 'review_reminder',
          booking_id: freshBooking.id,
          session_id: freshBooking.session?.id,
          class_title: sessionTitle,
          teacher_name: teacherName,
          audience: 'learner',
        },
      });

      freshBooking.review_reminder_sent_at = new Date();
      freshBooking.review_reminder_failed_at = null;
      await bookingRepo.save(freshBooking);

      this.logger.log(
        `BOOKING_REVIEW_REMINDER_SENT bookingId=${freshBooking.id}`,
      );
    } catch (error: any) {
      freshBooking.review_reminder_failed_at = new Date();
      await bookingRepo.save(freshBooking);

      this.logger.error(
        `BOOKING_REVIEW_REMINDER_FAILED bookingId=${freshBooking.id} message=${error?.message ?? 'unknown'}`,
        error?.stack,
      );

      throw error;
    }
  }

  private getFirstName(user: any): string {
    if (!user) return 'there';

    if (typeof user.first_name === 'string' && user.first_name.trim()) {
      return user.first_name.trim();
    }

    if (typeof user.firstName === 'string' && user.firstName.trim()) {
      return user.firstName.trim();
    }

    if (typeof user.full_name === 'string' && user.full_name.trim()) {
      return user.full_name.trim().split(' ')[0];
    }

    if (typeof user.fullName === 'string' && user.fullName.trim()) {
      return user.fullName.trim().split(' ')[0];
    }

    return 'there';
  }

  private getTeacherDisplayName(teacher: any): string {
    if (!teacher) return 'your teacher';

    const firstName =
      typeof teacher.first_name === 'string' && teacher.first_name.trim()
        ? teacher.first_name.trim()
        : typeof teacher.firstName === 'string' && teacher.firstName.trim()
          ? teacher.firstName.trim()
          : '';

    const lastName =
      typeof teacher.last_name === 'string' && teacher.last_name.trim()
        ? teacher.last_name.trim()
        : typeof teacher.lastName === 'string' && teacher.lastName.trim()
          ? teacher.lastName.trim()
          : '';

    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;

    if (typeof teacher.full_name === 'string' && teacher.full_name.trim()) {
      return teacher.full_name.trim();
    }

    if (typeof teacher.fullName === 'string' && teacher.fullName.trim()) {
      return teacher.fullName.trim();
    }

    return 'your teacher';
  }

  private formatSessionDate(value: any): string {
    if (!value) return 'TBC';

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'TBC';
    }

    return date.toLocaleString('en-IE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private formatLocationText(session: any): string {
    if (!session) return 'Location shared in the app';

    if (
      typeof session.rough_location === 'string' &&
      session.rough_location.trim()
    ) {
      return session.rough_location.trim();
    }

    return 'Location shared in the app';
  }
}