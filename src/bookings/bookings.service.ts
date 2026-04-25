import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Session, SessionType } from '../sessions/entities/session.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { containsBlockedContactOrOffPlatformContent } from '../utils/content-moderation';
import { EmailService } from '../email/email.service';
import { BookingEmailBuilder } from '../email/builders/booking-email.builder';
import { PaymentsService } from '../payments/payments.service';
import { PushNotificationsService } from '../notifications/push-notifications.service';

type BookingWithRelations = Booking & {
  user: any;
  session: any;
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly bookingEmailBuilder: BookingEmailBuilder,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  async createBooking(
    userId: string,
    sessionId: string,
    introMessage?: string,
  ) {
    this.logger.log(
      `BOOKING_CREATE_ATTEMPT userId=${userId} sessionId=${sessionId}`,
    );

    if (!sessionId) {
      this.logger.warn(`BOOKING_CREATE_MISSING_SESSION_ID userId=${userId}`);
      throw new BadRequestException('sessionId is required');
    }

    if (
      introMessage &&
      containsBlockedContactOrOffPlatformContent(introMessage)
    ) {
      this.logger.warn(
        `BOOKING_CREATE_BLOCKED_CONTENT userId=${userId} sessionId=${sessionId}`,
      );
      throw new BadRequestException(
        'Please keep communication on the platform. Do not include phone numbers, email addresses, social handles, or external sites in your message.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const session = await manager
        .getRepository(Session)
        .createQueryBuilder('session')
        .where('session.id = :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) {
        this.logger.warn(
          `BOOKING_CREATE_SESSION_NOT_FOUND userId=${userId} sessionId=${sessionId}`,
        );
        throw new NotFoundException('Session not found');
      }

      const sessionWithTeacher = await manager.getRepository(Session).findOne({
        where: { id: sessionId },
        relations: {
          teacher: true,
          class: true,
        } as any,
      });

      if (!sessionWithTeacher) {
        this.logger.warn(
          `BOOKING_CREATE_SESSION_NOT_FOUND_AFTER_LOCK userId=${userId} sessionId=${sessionId}`,
        );
        throw new NotFoundException('Session not found');
      }

      if (sessionWithTeacher.teacher?.id === userId) {
        this.logger.warn(
          `BOOKING_CREATE_SELF_BOOKING_BLOCKED userId=${userId} sessionId=${sessionId}`,
        );
        throw new BadRequestException('You cannot book your own session');
      }

      if (sessionWithTeacher.session_type === SessionType.PRIVATE) {
        if (!sessionWithTeacher.private_invitee_user_id) {
          this.logger.warn(
            `BOOKING_CREATE_PRIVATE_SESSION_NO_INVITEE userId=${userId} sessionId=${sessionId}`,
          );
          throw new ForbiddenException(
            'This private session is not available for booking.',
          );
        }

        if (sessionWithTeacher.private_invitee_user_id !== userId) {
          this.logger.warn(
            `BOOKING_CREATE_PRIVATE_SESSION_FORBIDDEN userId=${userId} sessionId=${sessionId} inviteeUserId=${sessionWithTeacher.private_invitee_user_id}`,
          );
          throw new ForbiddenException(
            'This private session is only available to the invited learner.',
          );
        }
      }

      const now = new Date();
      if (session.start_time <= now) {
        this.logger.warn(
          `BOOKING_CREATE_PAST_SESSION userId=${userId} sessionId=${sessionId}`,
        );
        throw new BadRequestException(
          'Session already started or is in the past',
        );
      }

      const existingBooking = await manager
        .getRepository(Booking)
        .createQueryBuilder('b')
        .innerJoin('b.user', 'u')
        .innerJoin('b.session', 's')
        .where('u.id = :userId', { userId })
        .andWhere('s.id = :sessionId', { sessionId })
        .orderBy('b.createdAt', 'DESC')
        .getOne();

      if (existingBooking) {
        this.logger.warn(
          `BOOKING_CREATE_EXISTING_BOOKING userId=${userId} sessionId=${sessionId} existingBookingId=${existingBooking.id} status=${existingBooking.status}`,
        );

        throw new ConflictException(
          this.getDuplicateBookingMessage(existingBooking.status),
        );
      }

      const activeCount = await manager
        .getRepository(Booking)
        .createQueryBuilder('b')
        .innerJoin('b.session', 's')
        .where('s.id = :sessionId', { sessionId })
        .andWhere('b.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .getCount();

      if (activeCount >= session.max_participants) {
        this.logger.warn(
          `BOOKING_CREATE_FULL userId=${userId} sessionId=${sessionId} activeCount=${activeCount} maxParticipants=${session.max_participants}`,
        );
        throw new ConflictException('Session is fully booked');
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const booking = manager.create(Booking, {
        user: { id: userId } as any,
        session: { id: sessionId } as any,
        status: BookingStatus.PENDING,
        intro_message: introMessage?.trim() || null,
        expires_at: expiresAt,
      });

      let savedBooking: Booking;

      try {
        savedBooking = await manager.save(booking);
      } catch (error: any) {
        if (this.isUniqueConstraintViolation(error)) {
          this.logger.warn(
            `BOOKING_CREATE_DUPLICATE_DB_CONSTRAINT userId=${userId} sessionId=${sessionId}`,
          );

          const latestBooking = await manager
            .getRepository(Booking)
            .createQueryBuilder('b')
            .innerJoin('b.user', 'u')
            .innerJoin('b.session', 's')
            .where('u.id = :userId', { userId })
            .andWhere('s.id = :sessionId', { sessionId })
            .orderBy('b.createdAt', 'DESC')
            .getOne();

          throw new ConflictException(
            this.getDuplicateBookingMessage(latestBooking?.status),
          );
        }

        throw error;
      }

      await manager.getRepository(Notification).save(
        manager.getRepository(Notification).create({
          user_id: sessionWithTeacher.teacher.id,
          type: 'new_booking_started',
          title: 'New booking started',
          body: `A learner started booking ${sessionWithTeacher.class?.title ?? 'your session'}. Payment is still pending.`,
          payload: {
            booking_id: savedBooking.id,
            session_id: sessionWithTeacher.id,
            class_title: sessionWithTeacher.class?.title ?? null,
          },
        }),
      );

      this.logger.log(
        `BOOKING_CREATE_SUCCESS bookingId=${savedBooking.id} userId=${userId} sessionId=${sessionId}`,
      );

      return savedBooking;
    });
  }

  async getBookingByIdForLifecycle(
    bookingId: string,
  ): Promise<BookingWithRelations> {
    const booking = await this.dataSource.getRepository(Booking).findOne({
      where: { id: bookingId },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking as BookingWithRelations;
  }

  async markBookingConfirmed(params: {
    bookingId: string;
    stripePaymentIntentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    paidAt?: Date;
  }) {
    const {
      bookingId,
      stripePaymentIntentId,
      stripeCheckoutSessionId,
      paidAt,
    } = params;

    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.status !== BookingStatus.PENDING) {
      this.logger.log(
        `BOOKING_CONFIRM_NOOP bookingId=${booking.id} status=${booking.status}`,
      );
      return booking;
    }

    booking.status = BookingStatus.CONFIRMED;
    booking.confirmed_at = new Date();
    booking.paid_at = paidAt ?? booking.paid_at ?? new Date();

    if (typeof stripePaymentIntentId === 'string') {
      booking.stripe_payment_intent_id = stripePaymentIntentId;
    }

    if (typeof stripeCheckoutSessionId === 'string') {
      booking.stripe_checkout_session_id = stripeCheckoutSessionId;
    }

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    this.logger.log(`BOOKING_CONFIRM_SUCCESS bookingId=${saved.id}`);

    await this.sendBookingConfirmedEmail(saved);

    return saved;
  }

  async cancelBookingByLearner(bookingId: string, learnerId: string) {
    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.user.id !== learnerId) {
      throw new ForbiddenException('Not your booking');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed bookings can be cancelled');
    }

    booking.status = BookingStatus.CANCELLED_BY_LEARNER;
    booking.cancelled_at = new Date();
    booking.cancelled_by_user_id = learnerId;

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    const classTitle = saved.session?.class?.title ?? 'your session';

    if (saved.session?.teacher?.id) {
      await this.dataSource.getRepository(Notification).save(
        this.dataSource.getRepository(Notification).create({
          user_id: saved.session.teacher.id,
          type: 'booking_cancelled_by_learner',
          title: 'Booking cancelled',
          body: `A learner cancelled their booking for ${classTitle}.`,
          payload: {
            booking_id: saved.id,
            session_id: saved.session?.id,
            class_title: classTitle,
          },
        }),
      );

      await this.pushNotificationsService.sendToUser(saved.session.teacher.id, {
        title: 'Booking cancelled',
        body: `A learner cancelled their booking for ${classTitle}.`,
        data: {
          type: 'booking_cancelled_by_learner',
          booking_id: saved.id,
          session_id: saved.session?.id,
          class_title: classTitle,
        },
      });
    }

    this.logger.log(
      `BOOKING_CANCELLED_BY_LEARNER bookingId=${saved.id} learnerId=${learnerId}`,
    );

    await this.triggerRefundFlowForCancelledBooking(saved.id);
    await this.sendBookingCancelledEmails(saved, 'learner');

    return saved;
  }

  async cancelBookingByTeacher(bookingId: string, teacherId: string) {
    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.session?.teacher?.id !== teacherId) {
      throw new ForbiddenException(
        'You can only cancel your own session bookings',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed bookings can be cancelled');
    }

    booking.status = BookingStatus.CANCELLED_BY_TEACHER;
    booking.cancelled_at = new Date();
    booking.cancelled_by_user_id = teacherId;

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    const classTitle = saved.session?.class?.title ?? 'your session';

    await this.dataSource.getRepository(Notification).save(
      this.dataSource.getRepository(Notification).create({
        user_id: saved.user.id,
        type: 'booking_cancelled_by_teacher',
        title: 'Session cancelled',
        body: `Your booking for ${classTitle} was cancelled by the teacher.`,
        payload: {
          booking_id: saved.id,
          session_id: saved.session?.id,
          class_title: classTitle,
        },
      }),
    );

    await this.pushNotificationsService.sendToUser(saved.user.id, {
      title: 'Session cancelled',
      body: `Your booking for ${classTitle} was cancelled by the teacher.`,
      data: {
        type: 'booking_cancelled_by_teacher',
        booking_id: saved.id,
        session_id: saved.session?.id,
        class_title: classTitle,
      },
    });

    this.logger.log(
      `BOOKING_CANCELLED_BY_TEACHER bookingId=${saved.id} teacherId=${teacherId}`,
    );

    await this.triggerRefundFlowForCancelledBooking(saved.id);
    await this.sendBookingCancelledEmails(saved, 'teacher');

    return saved;
  }

  async markBookingRefundPending(
    bookingId: string,
    options?: { sendEmail?: boolean },
  ) {
    const sendEmail = options?.sendEmail ?? true;

    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.status === BookingStatus.REFUND_PENDING) {
      this.logger.log(`BOOKING_REFUND_PENDING_NOOP bookingId=${booking.id}`);
      return booking;
    }

    if (
      booking.status !== BookingStatus.CANCELLED_BY_LEARNER &&
      booking.status !== BookingStatus.CANCELLED_BY_TEACHER &&
      booking.status !== BookingStatus.REFUND_FAILED
    ) {
      throw new BadRequestException(
        'Only cancelled or refund-failed bookings can move to refund pending',
      );
    }

    booking.status = BookingStatus.REFUND_PENDING;

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    this.logger.log(`BOOKING_REFUND_PENDING bookingId=${saved.id}`);

    if (sendEmail) {
      await this.sendRefundPendingEmail(saved);
    }

    return saved;
  }

  async markBookingRefunded(params: {
    bookingId: string;
    refundAmount: number;
    stripeRefundId?: string | null;
    refundedAt?: Date;
  }) {
    const { bookingId, refundAmount, stripeRefundId, refundedAt } = params;

    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.status === BookingStatus.REFUNDED) {
      this.logger.log(`BOOKING_REFUNDED_NOOP bookingId=${booking.id}`);
      return booking;
    }

    if (
      booking.status !== BookingStatus.REFUND_PENDING &&
      booking.status !== BookingStatus.REFUND_FAILED
    ) {
      throw new BadRequestException(
        'Only refund-pending or refund-failed bookings can be marked refunded',
      );
    }

    booking.status = BookingStatus.REFUNDED;
    booking.refund_amount = refundAmount;
    booking.refunded_at = refundedAt ?? new Date();
    booking.refund_failure_reason = null;
    booking.refund_next_retry_at = null;
    booking.refund_last_retry_at = new Date();

    if (typeof stripeRefundId === 'string') {
      booking.stripe_refund_id = stripeRefundId;
    }

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    this.logger.log(
      `BOOKING_REFUNDED bookingId=${saved.id} refundAmount=${refundAmount}`,
    );

    await this.sendRefundCompletedEmail(saved);

    return saved;
  }

  async markBookingRefundFailed(params: {
    bookingId: string;
    stripeRefundId?: string | null;
    failureReason?: string | null;
    nextRetryAt?: Date | null;
    incrementRetryCount?: boolean;
  }) {
    const {
      bookingId,
      stripeRefundId,
      failureReason,
      nextRetryAt,
      incrementRetryCount = false,
    } = params;

    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (
      booking.status !== BookingStatus.REFUND_PENDING &&
      booking.status !== BookingStatus.CANCELLED_BY_LEARNER &&
      booking.status !== BookingStatus.CANCELLED_BY_TEACHER &&
      booking.status !== BookingStatus.REFUND_FAILED
    ) {
      throw new BadRequestException(
        'Only cancelled, refund-pending, or refund-failed bookings can be marked refund failed',
      );
    }

    booking.status = BookingStatus.REFUND_FAILED;
    booking.refund_failure_reason = failureReason ?? null;
    booking.refund_last_retry_at = new Date();
    booking.refund_next_retry_at = nextRetryAt ?? null;

    if (incrementRetryCount) {
      booking.refund_retry_count = (booking.refund_retry_count ?? 0) + 1;
    }

    if (typeof stripeRefundId === 'string') {
      booking.stripe_refund_id = stripeRefundId;
    }

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    this.logger.warn(
      `BOOKING_REFUND_FAILED bookingId=${saved.id} stripeRefundId=${stripeRefundId ?? 'none'} failureReason=${failureReason ?? 'unknown'} refundRetryCount=${saved.refund_retry_count ?? 0} nextRetryAt=${saved.refund_next_retry_at?.toISOString?.() ?? 'none'}`,
    );

    return saved;
  }

  async getMyBookings(userId: string) {
    this.logger.log(`BOOKINGS_GET_MY_BOOKINGS userId=${userId}`);

    return this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.session', 's')
      .leftJoinAndSelect('s.class', 'c')
      .leftJoinAndSelect('s.teacher', 't')
      .leftJoin('teacher_profiles', 'tp', 'tp.user_id = t.id')
      .where('b.user_id = :userId', { userId })
      .orderBy('s.start_time', 'ASC')
      .select([
        'b.id AS booking_id',
        'b.status AS booking_status',
        'b.createdAt AS booking_created_at',
        'b.confirmed_at AS booking_confirmed_at',
        'b.cancelled_at AS booking_cancelled_at',
        'b.refunded_at AS booking_refunded_at',

        's.id AS session_id',
        's.start_time AS session_start_time',
        's.price AS session_price',
        's.max_participants AS session_max_participants',
        's.rough_location AS session_rough_location',
        's.arrival_instructions AS session_arrival_instructions',
        's.session_type AS session_type',

        'c.title AS class_title',
        'c.category AS class_category',

        'tp.full_name AS teacher_name',
      ])
      .getRawMany();
  }

  private async triggerRefundFlowForCancelledBooking(
    bookingId: string,
  ): Promise<void> {
    try {
      const booking = await this.getBookingByIdForLifecycle(bookingId);

      if (!this.shouldAutoRefund(booking)) {
        this.logger.log(
          `BOOKING_REFUND_SKIPPED bookingId=${bookingId} reason=${this.getNoRefundReason(booking)}`,
        );
        return;
      }

      const refund = await this.paymentsService.createRefundForBooking(bookingId);

      const current = await this.getBookingByIdForLifecycle(bookingId);

      if (
        current.status === BookingStatus.CANCELLED_BY_LEARNER ||
        current.status === BookingStatus.CANCELLED_BY_TEACHER
      ) {
        await this.markBookingRefundPending(bookingId, { sendEmail: true });
      }

      if (refund.status === 'succeeded') {
        await this.markBookingRefunded({
          bookingId,
          refundAmount: refund.amount,
          stripeRefundId: refund.id,
          refundedAt: new Date(),
        });
      }

      if (refund.status === 'failed' || refund.status === 'canceled') {
        await this.markBookingRefundFailed({
          bookingId,
          stripeRefundId: refund.id,
          failureReason: refund.failure_reason ?? refund.status,
          nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
          incrementRetryCount: true,
        });
      }

      this.logger.log(
        `BOOKING_REFUND_TRIGGERED bookingId=${bookingId} refundId=${refund.id} refundStatus=${refund.status}`,
      );
    } catch (error: any) {
      this.logger.error(
        `BOOKING_REFUND_TRIGGER_FAILED bookingId=${bookingId} message=${error?.message ?? error}`,
      );
    }
  }

  private shouldAutoRefund(booking: BookingWithRelations): boolean {
    if (booking.status === BookingStatus.CANCELLED_BY_TEACHER) {
      return true;
    }

    if (booking.status === BookingStatus.CANCELLED_BY_LEARNER) {
      const sessionStart = booking.session?.start_time
        ? new Date(booking.session.start_time)
        : null;

      if (!sessionStart || Number.isNaN(sessionStart.getTime())) {
        return false;
      }

      const hoursUntilSession =
        (sessionStart.getTime() - Date.now()) / (1000 * 60 * 60);

      return hoursUntilSession >= 12;
    }

    return false;
  }

  private getNoRefundReason(booking: BookingWithRelations): string {
    if (booking.status === BookingStatus.CANCELLED_BY_TEACHER) {
      return 'unknown';
    }

    if (booking.status === BookingStatus.CANCELLED_BY_LEARNER) {
      const sessionStart = booking.session?.start_time
        ? new Date(booking.session.start_time)
        : null;

      if (!sessionStart || Number.isNaN(sessionStart.getTime())) {
        return 'missing_or_invalid_session_start';
      }

      const hoursUntilSession =
        (sessionStart.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilSession < 12) {
        return 'learner_cancelled_less_than_12h_before_start';
      }
    }

    return 'not_refund_eligible';
  }

  private async sendBookingConfirmedEmail(
    booking: BookingWithRelations,
  ): Promise<void> {
    try {
      const learnerEmail = booking.user?.email;
      if (!learnerEmail) {
        this.logger.warn(
          `BOOKING_CONFIRM_EMAIL_SKIPPED_NO_LEARNER_EMAIL bookingId=${booking.id}`,
        );
        return;
      }

      const email = await this.bookingEmailBuilder.buildBookingConfirmed({
        to: learnerEmail,
        learnerFirstName: this.getFirstName(booking.user),
        sessionTitle: booking.session?.class?.title ?? 'Session',
        teacherName: this.getTeacherDisplayName(booking.session?.teacher),
        startAtLabel: this.formatSessionDate(booking.session?.start_time),
        locationText: this.formatLocationText(booking.session),
        bookingId: booking.id,
      });

      await this.emailService.send(email);

      this.logger.log(`BOOKING_CONFIRM_EMAIL_SENT bookingId=${booking.id}`);
    } catch (error: any) {
      this.logger.error(
        `BOOKING_CONFIRM_EMAIL_FAILED bookingId=${booking.id} message=${error?.message ?? error}`,
      );
    }
  }

  private async sendBookingCancelledEmails(
    booking: BookingWithRelations,
    cancelledBy: 'learner' | 'teacher',
  ): Promise<void> {
    const sessionTitle = booking.session?.class?.title ?? 'Session';
    const startAtLabel = this.formatSessionDate(booking.session?.start_time);

    try {
      const learnerEmail = booking.user?.email;
      if (learnerEmail) {
        const refundMessage = this.shouldAutoRefund(booking)
          ? 'Any eligible refund will be processed shortly.'
          : 'This cancellation does not qualify for an automatic refund under the current policy.';

        const learnerEmailPayload =
          await this.bookingEmailBuilder.buildBookingCancelled({
            to: learnerEmail,
            recipientFirstName: this.getFirstName(booking.user),
            sessionTitle,
            cancelledByLabel:
              cancelledBy === 'learner' ? 'you' : 'the teacher',
            startAtLabel,
            refundMessage,
            bookingId: booking.id,
          });

        await this.emailService.send(learnerEmailPayload);

        this.logger.log(
          `BOOKING_CANCELLED_EMAIL_SENT_TO_LEARNER bookingId=${booking.id}`,
        );
      } else {
        this.logger.warn(
          `BOOKING_CANCELLED_EMAIL_SKIPPED_NO_LEARNER_EMAIL bookingId=${booking.id}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `BOOKING_CANCELLED_EMAIL_FAILED_TO_LEARNER bookingId=${booking.id} message=${error?.message ?? error}`,
      );
    }

    try {
      const teacherEmail = booking.session?.teacher?.email;
      if (teacherEmail) {
        const teacherCancelledByLabel =
          cancelledBy === 'learner' ? this.getFirstName(booking.user) : 'you';

        const teacherEmailPayload =
          await this.bookingEmailBuilder.buildBookingCancelled({
            to: teacherEmail,
            recipientFirstName: this.getFirstName(booking.session?.teacher),
            sessionTitle,
            cancelledByLabel: teacherCancelledByLabel,
            startAtLabel,
            refundMessage: undefined,
            bookingId: booking.id,
          });

        await this.emailService.send(teacherEmailPayload);

        this.logger.log(
          `BOOKING_CANCELLED_EMAIL_SENT_TO_TEACHER bookingId=${booking.id}`,
        );
      } else {
        this.logger.warn(
          `BOOKING_CANCELLED_EMAIL_SKIPPED_NO_TEACHER_EMAIL bookingId=${booking.id}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `BOOKING_CANCELLED_EMAIL_FAILED_TO_TEACHER bookingId=${booking.id} message=${error?.message ?? error}`,
      );
    }
  }

  private async sendRefundPendingEmail(
    booking: BookingWithRelations,
  ): Promise<void> {
    try {
      const learnerEmail = booking.user?.email;
      if (!learnerEmail) {
        this.logger.warn(
          `BOOKING_REFUND_PENDING_EMAIL_SKIPPED_NO_LEARNER_EMAIL bookingId=${booking.id}`,
        );
        return;
      }

      const email = await this.bookingEmailBuilder.buildRefundPending({
        to: learnerEmail,
        recipientFirstName: this.getFirstName(booking.user),
        sessionTitle: booking.session?.class?.title ?? 'Session',
        startAtLabel: this.formatSessionDate(booking.session?.start_time),
        bookingId: booking.id,
      });

      await this.emailService.send(email);

      this.logger.log(
        `BOOKING_REFUND_PENDING_EMAIL_SENT bookingId=${booking.id}`,
      );
    } catch (error: any) {
      this.logger.error(
        `BOOKING_REFUND_PENDING_EMAIL_FAILED bookingId=${booking.id} message=${error?.message ?? error}`,
      );
    }
  }

  private async sendRefundCompletedEmail(
    booking: BookingWithRelations,
  ): Promise<void> {
    try {
      const learnerEmail = booking.user?.email;
      if (!learnerEmail) {
        this.logger.warn(
          `BOOKING_REFUND_COMPLETED_EMAIL_SKIPPED_NO_LEARNER_EMAIL bookingId=${booking.id}`,
        );
        return;
      }

      const email = await this.bookingEmailBuilder.buildRefundCompleted({
        to: learnerEmail,
        recipientFirstName: this.getFirstName(booking.user),
        sessionTitle: booking.session?.class?.title ?? 'Session',
        startAtLabel: this.formatSessionDate(booking.session?.start_time),
        bookingId: booking.id,
        refundAmountLabel: this.formatMoneyFromMinorUnits(booking.refund_amount),
      });

      await this.emailService.send(email);

      await this.pushNotificationsService.sendToUser(booking.user.id, {
        title: 'Refund completed',
        body: `Your refund for ${booking.session?.class?.title ?? 'Session'} has been completed.`,
        data: {
          type: 'refund_completed',
          booking_id: booking.id,
          session_id: booking.session?.id,
          class_title: booking.session?.class?.title ?? 'Session',
        },
      });

      this.logger.log(
        `BOOKING_REFUND_COMPLETED_EMAIL_SENT bookingId=${booking.id}`,
      );
    } catch (error: any) {
      this.logger.error(
        `BOOKING_REFUND_COMPLETED_EMAIL_FAILED bookingId=${booking.id} message=${error?.message ?? error}`,
      );
    }
  }

  private formatMoneyFromMinorUnits(amount?: number | null): string | undefined {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return undefined;
    }

    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount / 100);
  }

  private getDuplicateBookingMessage(status?: BookingStatus): string {
    switch (status) {
      case BookingStatus.PENDING:
        return 'You already started booking this session. Complete payment to confirm it.';

      case BookingStatus.CONFIRMED:
        return 'You already booked this session.';

      case BookingStatus.CANCELLED_BY_TEACHER:
        return 'Your previous booking for this session was cancelled by the teacher, so it cannot be booked again.';

      case BookingStatus.CANCELLED_BY_LEARNER:
        return 'You already cancelled this session and it cannot be booked again.';

      case BookingStatus.REFUND_PENDING:
      case BookingStatus.REFUNDED:
      case BookingStatus.REFUND_FAILED:
        return 'Your previous booking for this session has already been cancelled.';

      case BookingStatus.EXPIRED:
        return 'Your previous booking attempt for this session expired and it cannot be booked again.';

      default:
        return 'You already have a booking record for this session.';
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (error as any)?.driverError;
    return driverError?.code === '23505';
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
    if (!session) return 'Location shared after booking';

    if (
      typeof session.rough_location === 'string' &&
      session.rough_location.trim()
    ) {
      return session.rough_location.trim();
    }

    return 'Location shared in the app';
  }

  async getBookingDetailsForLearner(bookingId: string, learnerId: string) {
    this.logger.log(
      `BOOKING_GET_DETAILS_ATTEMPT bookingId=${bookingId} learnerId=${learnerId}`,
    );

    const booking = await this.dataSource.getRepository(Booking).findOne({
      where: { id: bookingId },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!booking) {
      this.logger.warn(
        `BOOKING_GET_DETAILS_NOT_FOUND bookingId=${bookingId} learnerId=${learnerId}`,
      );
      throw new NotFoundException('Booking not found');
    }

    if (booking.user.id !== learnerId) {
      this.logger.warn(
        `BOOKING_GET_DETAILS_FORBIDDEN bookingId=${bookingId} learnerId=${learnerId} bookingUserId=${booking.user.id}`,
      );
      throw new ForbiddenException('Not your booking');
    }

    const teacherName = this.getTeacherDisplayName(booking.session?.teacher);

    return {
      id: booking.id,
      status: booking.status,
      intro_message: booking.intro_message,
      created_at: booking.createdAt,
      confirmed_at: booking.confirmed_at,
      cancelled_at: booking.cancelled_at,
      cancelled_by_user_id: booking.cancelled_by_user_id,
      refunded_at: booking.refunded_at,
      refund_amount: booking.refund_amount,
      refund_failure_reason: booking.refund_failure_reason,
      paid_at: booking.paid_at,
      amount: booking.amount,
      currency: booking.currency,
      session: booking.session
        ? {
            id: booking.session.id,
            start_time: booking.session.start_time,
            end_time: booking.session.end_time,
            duration: booking.session.duration,
            price: booking.session.price,
            max_participants: booking.session.max_participants,
            rough_location: booking.session.rough_location,
            arrival_instructions: booking.session.arrival_instructions,
            session_type: booking.session.session_type ?? SessionType.GROUP,
            private_invitee_user_id:
              booking.session.private_invitee_user_id ?? null,
            class: booking.session.class
              ? {
                  title: booking.session.class.title,
                  category: booking.session.class.category,
                }
              : null,
            teacher: booking.session.teacher
              ? {
                  id: booking.session.teacher.id,
                  first_name: booking.session.teacher.first_name,
                  full_name: teacherName,
                }
              : null,
          }
        : null,
    };
  }
}