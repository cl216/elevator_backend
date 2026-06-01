import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { NotificationsService } from './notifications.service';
import { PushNotificationsService } from './push-notifications.service';

@Injectable()
export class BookingRemindersService {
  private readonly logger = new Logger(BookingRemindersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Cron('*/10 * * * *')
  async runBookingReminderChecks() {
    await this.send24HourReminders();
    await this.send1HourReminders();
    await this.sendPostSessionPrompts();
  }

  private async send24HourReminders() {
    const bookings = await this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.user', 'learner')
      .innerJoinAndSelect('b.session', 's')
      .innerJoinAndSelect('s.teacher', 'teacher')
      .innerJoinAndSelect('s.class', 'class')
      .where('b.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('b.reminder_24h_sent_at IS NULL')
      .andWhere(`s.start_time BETWEEN NOW() + INTERVAL '23 hours 45 minutes' AND NOW() + INTERVAL '24 hours 15 minutes'`)
      .limit(50)
      .getMany();

    for (const booking of bookings) {
      await this.notifyLearnerAndTeacher(
        booking,
        'session_reminder_24h',
        'teacher_session_reminder_24h',
        'Session tomorrow',
        `${booking.session?.class?.title ?? 'Your session'} is tomorrow.`,
        'Session tomorrow',
        `${booking.session?.class?.title ?? 'Your session'} is tomorrow.`,
      );

      booking.reminder_24h_sent_at = new Date();
      await this.dataSource.getRepository(Booking).save(booking);
    }
  }

  private async send1HourReminders() {
    const bookings = await this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.user', 'learner')
      .innerJoinAndSelect('b.session', 's')
      .innerJoinAndSelect('s.teacher', 'teacher')
      .innerJoinAndSelect('s.class', 'class')
      .where('b.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('b.reminder_1h_sent_at IS NULL')
      .andWhere(`s.start_time BETWEEN NOW() + INTERVAL '45 minutes' AND NOW() + INTERVAL '75 minutes'`)
      .limit(50)
      .getMany();

    for (const booking of bookings) {
      await this.notifyLearnerAndTeacher(
        booking,
        'session_reminder_1h',
        'teacher_session_reminder_1h',
        'Session starting soon',
        `${booking.session?.class?.title ?? 'Your session'} starts in about 1 hour.`,
        'Session starting soon',
        `${booking.session?.class?.title ?? 'Your session'} starts in about 1 hour.`,
      );

      booking.reminder_1h_sent_at = new Date();
      await this.dataSource.getRepository(Booking).save(booking);
    }
  }

  private async sendPostSessionPrompts() {
    const bookings = await this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.user', 'learner')
      .innerJoinAndSelect('b.session', 's')
      .innerJoinAndSelect('s.teacher', 'teacher')
      .innerJoinAndSelect('s.class', 'class')
      .where('b.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('b.review_reminder_sent_at IS NULL')
      .andWhere(`s.start_time <= NOW() - INTERVAL '15 minutes'`)
      .andWhere(`s.start_time >= NOW() - INTERVAL '24 hours'`)
      .limit(50)
      .getMany();

    for (const booking of bookings) {
      const classTitle = booking.session?.class?.title ?? 'your session';

      await this.notificationsService.createAndPush(
        this.pushNotificationsService,
        {
          user_id: booking.user.id,
          type: 'review_reminder',
          title: 'How did your session go?',
          body: `Let us know how ${classTitle} went or report an issue within 24 hours.`,
          payload: {
            booking_id: booking.id,
            session_id: booking.session?.id,
            class_title: classTitle,
          },
        },
      );

      if (booking.session?.teacher?.id) {
        await this.notificationsService.createAndPush(
          this.pushNotificationsService,
          {
            user_id: booking.session.teacher.id,
            type: 'teacher_attendance_check',
            title: 'Did your learner attend?',
            body: `Confirm attendance or report a learner no-show for ${classTitle} within 24 hours.`,
            payload: {
              booking_id: booking.id,
              session_id: booking.session?.id,
              class_title: classTitle,
            },
          },
        );
      }

      booking.review_reminder_sent_at = new Date();
      await this.dataSource.getRepository(Booking).save(booking);
    }
  }

  private async notifyLearnerAndTeacher(
    booking: Booking,
    learnerType: string,
    teacherType: string,
    learnerTitle: string,
    learnerBody: string,
    teacherTitle: string,
    teacherBody: string,
  ) {
    const classTitle = booking.session?.class?.title ?? 'your session';

    await this.notificationsService.createAndPush(
      this.pushNotificationsService,
      {
        user_id: booking.user.id,
        type: learnerType,
        title: learnerTitle,
        body: learnerBody,
        payload: {
          booking_id: booking.id,
          session_id: booking.session?.id,
          class_title: classTitle,
        },
      },
    );

    if (booking.session?.teacher?.id) {
      await this.notificationsService.createAndPush(
        this.pushNotificationsService,
        {
          user_id: booking.session.teacher.id,
          type: teacherType,
          title: teacherTitle,
          body: teacherBody,
          payload: {
            booking_id: booking.id,
            session_id: booking.session?.id,
            class_title: classTitle,
          },
        },
      );
    }
  }
}