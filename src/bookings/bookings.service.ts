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
import { Cron } from '@nestjs/schedule';
import { DataSource, QueryFailedError } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Session, SessionType } from '../sessions/entities/session.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { containsBlockedContactOrOffPlatformContent } from '../utils/content-moderation';
import { EmailService } from '../email/email.service';
import { BookingEmailBuilder } from '../email/builders/booking-email.builder';
import { PaymentsService } from '../payments/payments.service';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { User } from '../users/user.entity';

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
    throw new BadRequestException("sessionId is required");
  }

  if (
    introMessage &&
    containsBlockedContactOrOffPlatformContent(introMessage)
  ) {
    throw new BadRequestException(
      "Please keep communication on the platform. Do not include phone numbers, email addresses, social handles, or external sites in your message.",
    );
  }

  return this.dataSource.transaction(async (manager) => {
    const session = await manager
      .getRepository(Session)
      .createQueryBuilder("session")
      .where("session.id = :sessionId", { sessionId })
      .setLock("pessimistic_write")
      .getOne();

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    const sessionWithTeacher = await manager.getRepository(Session).findOne({
      where: { id: sessionId },
      relations: {
        teacher: true,
        class: true,
      } as any,
    });

    if (!sessionWithTeacher) {
      throw new NotFoundException("Session not found");
    }

    if (sessionWithTeacher.teacher?.id === userId) {
      throw new BadRequestException("You cannot book your own session");
    }

    const learner = await manager.getRepository(User).findOne({
      where: { id: userId },
    });

    if (!learner?.image_url?.trim()) {
      throw new BadRequestException(
        "Please add a profile photo before booking so the teacher can recognize you.",
      );
    }

    if (sessionWithTeacher.session_type === SessionType.PRIVATE) {
      if (!sessionWithTeacher.private_invitee_user_id) {
        throw new ForbiddenException(
          "This private session is not available for booking.",
        );
      }

      if (sessionWithTeacher.private_invitee_user_id !== userId) {
        throw new ForbiddenException(
          "This private session is only available to the invited learner.",
        );
      }
    }

    if (session.start_time <= new Date()) {
      throw new BadRequestException("Session already started or is in the past");
    }

    const bookingRepo = manager.getRepository(Booking);

function resetBookingForFreshCheckout(booking: Booking) {
  booking.status = BookingStatus.PENDING;
  booking.expires_at = new Date(Date.now() + 15 * 60 * 1000);
  booking.intro_message = introMessage?.trim() || null;

  booking.cancelled_at = null;
  booking.cancelled_by_user_id = null;
  booking.confirmed_at = null;
  booking.paid_at = null;

  booking.refunded_at = null;
  booking.refund_amount = null;
  booking.refund_failure_reason = null;
  booking.refund_next_retry_at = null;
  booking.refund_last_retry_at = null;
  booking.refund_retry_count = 0;
  booking.stripe_refund_id = null;

  booking.stripe_checkout_session_id = null;
  booking.checkout_created_at = null;
  booking.stripe_payment_intent_id = null;
  booking.amount = null;
  booking.currency = null;

  booking.lesson_amount = null;
booking.platform_fee_amount = null;
booking.stripe_fee_amount = null;
booking.total_amount = null;
booking.teacher_payout_amount = null;

booking.completed_at = null;
booking.disputed_at = null;
booking.dispute_reason = null;
booking.learner_no_show_at = null;
booking.teacher_no_show_at = null;

  return booking;
}

    const existingBooking = await bookingRepo
      .createQueryBuilder("b")
      .innerJoin("b.user", "u")
      .innerJoin("b.session", "s")
      .where("u.id = :userId", { userId })
      .andWhere("s.id = :sessionId", { sessionId })
      .orderBy("b.createdAt", "DESC")
      .getOne();

    if (existingBooking) {
      this.logger.warn(
        `BOOKING_CREATE_EXISTING_BOOKING userId=${userId} sessionId=${sessionId} existingBookingId=${existingBooking.id} status=${existingBooking.status}`,
      );

      if (existingBooking.status === BookingStatus.PENDING) {
        const expiresAt =
          existingBooking.expires_at instanceof Date
            ? existingBooking.expires_at
            : existingBooking.createdAt
              ? new Date(existingBooking.createdAt.getTime() + 15 * 60 * 1000)
              : null;

        const isExpired = !!expiresAt && expiresAt.getTime() <= Date.now();
        const hasOldCheckout = !!(existingBooking as any).stripe_checkout_session_id;

        if (!isExpired && !hasOldCheckout) {
          throw new ConflictException({
            code: "BOOKING_PAYMENT_PENDING",
            message:
              "You already started booking this session. Complete payment to confirm it.",
            bookingId: existingBooking.id,
          });
        }

        resetBookingForFreshCheckout(existingBooking);

        const savedExisting = await bookingRepo.save(existingBooking);

        this.logger.log(
          `BOOKING_CREATE_RESET_PENDING_BOOKING bookingId=${savedExisting.id} userId=${userId} sessionId=${sessionId}`,
        );

        return savedExisting;
      }

      if (
        existingBooking.status === BookingStatus.EXPIRED ||
        existingBooking.status === BookingStatus.CANCELLED_BY_LEARNER ||
        existingBooking.status === BookingStatus.REFUND_PENDING ||
        existingBooking.status === BookingStatus.REFUNDED ||
        existingBooking.status === BookingStatus.REFUND_FAILED
      ) {
        resetBookingForFreshCheckout(existingBooking);

        const savedExisting = await bookingRepo.save(existingBooking);

        this.logger.log(
          `BOOKING_CREATE_REUSED_OLD_BOOKING bookingId=${savedExisting.id} userId=${userId} sessionId=${sessionId}`,
        );

        return savedExisting;
      }

      throw new ConflictException({
        code: "BOOKING_ALREADY_EXISTS",
        message: this.getDuplicateBookingMessage(existingBooking.status),
      });
    }

    const activeCount = await bookingRepo
      .createQueryBuilder("b")
      .innerJoin("b.session", "s")
      .where("s.id = :sessionId", { sessionId })
      .andWhere(
        `(b.status = :confirmedStatus OR (b.status = :pendingStatus AND b.expires_at > NOW()))`,
        {
          confirmedStatus: BookingStatus.CONFIRMED,
          pendingStatus: BookingStatus.PENDING,
        },
      )
      .getCount();

    if (activeCount >= session.max_participants) {
      throw new ConflictException("Session is fully booked");
    }

    const booking = bookingRepo.create({
      user: { id: userId } as any,
      session: { id: sessionId } as any,
      status: BookingStatus.PENDING,
      intro_message: introMessage?.trim() || null,
      expires_at: new Date(Date.now() + 15 * 60 * 1000),
    });

    let savedBooking: Booking;

    try {
      savedBooking = await bookingRepo.save(booking);
    } catch (error: any) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException({
          code: "BOOKING_ALREADY_EXISTS",
          message: "You already have a booking record for this session.",
        });
      }

      throw error;
    }

    await manager.getRepository(Notification).save(
      manager.getRepository(Notification).create({
        user_id: sessionWithTeacher.teacher.id,
        type: "new_booking_started",
        title: "New booking started",
        body: `A learner started booking ${
          sessionWithTeacher.class?.title ?? "your session"
        }. Payment is still pending.`,
        payload: {
          booking_id: savedBooking.id,
          session_id: sessionWithTeacher.id,
          class_title: sessionWithTeacher.class?.title ?? null,
        },
      }),
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

  const cancellableStatuses = [
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
  ];

  if (!cancellableStatuses.includes(booking.status)) {
    throw new BadRequestException('This booking can no longer be cancelled');
  }

  const wasConfirmed = booking.status === BookingStatus.CONFIRMED;

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
        body: wasConfirmed
          ? `A learner cancelled their booking for ${classTitle}.`
          : `A learner cancelled their pending booking for ${classTitle}.`,
        payload: {
          booking_id: saved.id,
          session_id: saved.session?.id,
          class_title: classTitle,
          was_confirmed: wasConfirmed,
        },
      }),
    );

    await this.pushNotificationsService.sendToUser(saved.session.teacher.id, {
      title: 'Booking cancelled',
      body: wasConfirmed
        ? `A learner cancelled their booking for ${classTitle}.`
        : `A learner cancelled their pending booking for ${classTitle}.`,
      data: {
        type: 'booking_cancelled_by_learner',
        booking_id: saved.id,
        session_id: saved.session?.id,
        class_title: classTitle,
        was_confirmed: String(wasConfirmed),
      },
    });
  }

  this.logger.log(
    `BOOKING_CANCELLED_BY_LEARNER bookingId=${saved.id} learnerId=${learnerId} wasConfirmed=${wasConfirmed}`,
  );

if (wasConfirmed) {
  await this.triggerRefundFlowForCancelledBooking(saved.id);
}

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
const wasConfirmed = booking.status === BookingStatus.CONFIRMED;
if (
  booking.status !== BookingStatus.CONFIRMED &&
  booking.status !== BookingStatus.PENDING
) {
  throw new BadRequestException('Only pending or confirmed bookings can be cancelled');
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

if (wasConfirmed) {
  await this.triggerRefundFlowForCancelledBooking(saved.id);
}

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
booking.status !== BookingStatus.TEACHER_NO_SHOW &&
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
booking.status !== BookingStatus.TEACHER_NO_SHOW &&
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

    async markLearnerNoShow(bookingId: string, teacherId: string) {
    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.session?.teacher?.id !== teacherId) {
      throw new ForbiddenException(
        'You can only mark no-show for your own session bookings',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only confirmed bookings can be marked as learner no-show',
      );
    }

    const sessionStart = booking.session?.start_time
      ? new Date(booking.session.start_time)
      : null;

    if (!sessionStart || Number.isNaN(sessionStart.getTime())) {
      throw new BadRequestException('Invalid session start time');
    }

    if (sessionStart.getTime() > Date.now()) {
      throw new BadRequestException(
        'You can only mark learner no-show after the session has started',
      );
    }

booking.status = BookingStatus.DISPUTED;
booking.learner_no_show_at = new Date();
booking.disputed_at = new Date();
booking.dispute_reason = 'learner_no_show_reported';

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    const classTitle = saved.session?.class?.title ?? 'your session';

    await this.dataSource.getRepository(Notification).save(
      this.dataSource.getRepository(Notification).create({
        user_id: saved.user.id,
        type: 'learner_no_show_recorded',
        title: 'No-show recorded',
        body: `The teacher marked you as not present for ${classTitle}. You can contact support if this is incorrect.`,
        payload: {
          booking_id: saved.id,
          session_id: saved.session?.id,
          class_title: classTitle,
        },
      }),
    );

    await this.pushNotificationsService.sendToUser(saved.user.id, {
      title: 'No-show recorded',
      body: `The teacher marked you as not present for ${classTitle}.`,
      data: {
        type: 'learner_no_show_recorded',
        booking_id: saved.id,
        session_id: saved.session?.id,
        class_title: classTitle,
      },
    });

    this.logger.log(
      `BOOKING_LEARNER_NO_SHOW bookingId=${saved.id} teacherId=${teacherId}`,
    );

    return saved;
  }

  async markTeacherNoShow(bookingId: string, learnerId: string) {
    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.user.id !== learnerId) {
      throw new ForbiddenException('Not your booking');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only confirmed bookings can be marked as teacher no-show',
      );
    }

    const sessionStart = booking.session?.start_time
      ? new Date(booking.session.start_time)
      : null;

    if (!sessionStart || Number.isNaN(sessionStart.getTime())) {
      throw new BadRequestException('Invalid session start time');
    }

    if (sessionStart.getTime() > Date.now()) {
      throw new BadRequestException(
        'You can only report teacher no-show after the session has started',
      );
    }

booking.status = BookingStatus.DISPUTED;
booking.teacher_no_show_at = new Date();
booking.disputed_at = new Date();
booking.dispute_reason = 'teacher_no_show_reported';

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    const classTitle = saved.session?.class?.title ?? 'your session';

    if (saved.session?.teacher?.id) {
      await this.dataSource.getRepository(Notification).save(
        this.dataSource.getRepository(Notification).create({
          user_id: saved.session.teacher.id,
          type: 'teacher_no_show_reported',
          title: 'Teacher no-show reported',
          body: `A learner reported that you did not attend ${classTitle}.`,
          payload: {
            booking_id: saved.id,
            session_id: saved.session?.id,
            class_title: classTitle,
          },
        }),
      );

      await this.pushNotificationsService.sendToUser(saved.session.teacher.id, {
        title: 'Teacher no-show reported',
        body: `A learner reported that you did not attend ${classTitle}.`,
        data: {
          type: 'teacher_no_show_reported',
          booking_id: saved.id,
          session_id: saved.session?.id,
          class_title: classTitle,
        },
      });
    }

    this.logger.warn(
      `BOOKING_TEACHER_NO_SHOW bookingId=${saved.id} learnerId=${learnerId}`,
    );


    return saved;
  }

  async disputeBooking(
    bookingId: string,
    learnerId: string,
    reason?: string,
  ) {
    const booking = await this.getBookingByIdForLifecycle(bookingId);

    if (booking.user.id !== learnerId) {
      throw new ForbiddenException('Not your booking');
    }

    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.COMPLETED &&
      booking.status !== BookingStatus.LEARNER_NO_SHOW
    ) {
      throw new BadRequestException(
        'Only confirmed, completed, or no-show bookings can be disputed',
      );
    }

    const sessionEnd = booking.session?.end_time
      ? new Date(booking.session.end_time)
      : null;

    if (!sessionEnd || Number.isNaN(sessionEnd.getTime())) {
      throw new BadRequestException('Invalid session end time');
    }

    const hoursSinceEnd =
      (Date.now() - sessionEnd.getTime()) / (1000 * 60 * 60);

if (hoursSinceEnd < 0) {
  throw new BadRequestException(
    'You can only dispute after the session ends',
  );
}

if (hoursSinceEnd > 24) {
  throw new BadRequestException(
    'Disputes must be raised within 24 hours after the session ends',
  );
}
    booking.status = BookingStatus.DISPUTED;
    booking.disputed_at = new Date();
    booking.dispute_reason = reason?.trim() || null;

    const saved = await this.dataSource.getRepository(Booking).save(booking);

    const classTitle = saved.session?.class?.title ?? 'your session';

    if (saved.session?.teacher?.id) {
      await this.dataSource.getRepository(Notification).save(
        this.dataSource.getRepository(Notification).create({
          user_id: saved.session.teacher.id,
          type: 'booking_disputed',
          title: 'Booking disputed',
          body: `A learner disputed ${classTitle}. Payout is paused while this is reviewed.`,
          payload: {
            booking_id: saved.id,
            session_id: saved.session?.id,
            class_title: classTitle,
            reason: saved.dispute_reason,
          },
        }),
      );

      await this.pushNotificationsService.sendToUser(saved.session.teacher.id, {
        title: 'Booking disputed',
        body: `A learner disputed ${classTitle}.`,
        data: {
          type: 'booking_disputed',
          booking_id: saved.id,
          session_id: saved.session?.id,
          class_title: classTitle,
        },
      });
    }

    this.logger.warn(
      `BOOKING_DISPUTED bookingId=${saved.id} learnerId=${learnerId} reason=${saved.dispute_reason ?? 'none'}`,
    );

    return saved;
  }

  @Cron('*/10 * * * *')
  async autoCompleteEligibleBookings() {
    const startedAt = Date.now();

    this.logger.log('BOOKING_AUTO_COMPLETE_CRON_STARTED');

    try {
      const bookings = await this.dataSource
        .getRepository(Booking)
        .createQueryBuilder('b')
        .innerJoinAndSelect('b.session', 's')
        .where('b.status = :confirmed', {
          confirmed: BookingStatus.CONFIRMED,
        })
        .andWhere(`s.end_time <= (NOW() - INTERVAL '24 hours')`)
        .orderBy('s.end_time', 'ASC')
        .limit(50)
        .getMany();

      for (const booking of bookings) {
        booking.status = BookingStatus.COMPLETED;
        booking.completed_at = new Date();

        await this.dataSource.getRepository(Booking).save(booking);

        this.logger.log(
          `BOOKING_AUTO_COMPLETED bookingId=${booking.id}`,
        );
      }

      this.logger.log(
        `BOOKING_AUTO_COMPLETE_CRON_COMPLETED count=${bookings.length} durationMs=${Date.now() - startedAt}`,
      );
    } catch (error: any) {
      this.logger.error(
        `BOOKING_AUTO_COMPLETE_CRON_FAILED message=${error?.message ?? 'unknown'}`,
        error?.stack,
      );
    }
  }

  private async triggerRefundFlowForTeacherNoShow(
    bookingId: string,
  ): Promise<void> {
    try {
      const refund = await this.paymentsService.createRefundForBooking(
        bookingId,
      );

      const current = await this.getBookingByIdForLifecycle(bookingId);

      if (current.status === BookingStatus.TEACHER_NO_SHOW) {
        await this.markBookingRefundPending(bookingId, {
          sendEmail: true,
        });
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
        `BOOKING_TEACHER_NO_SHOW_REFUND_TRIGGERED bookingId=${bookingId} refundId=${refund.id} refundStatus=${refund.status}`,
      );
    } catch (error: any) {
      this.logger.error(
        `BOOKING_TEACHER_NO_SHOW_REFUND_FAILED bookingId=${bookingId} message=${error?.message ?? error}`,
        error?.stack,
      );
    }
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

      'b.completed_at AS booking_completed_at',
'b.disputed_at AS booking_disputed_at',
'b.dispute_reason AS booking_dispute_reason',
'b.learner_no_show_at AS booking_learner_no_show_at',
'b.teacher_no_show_at AS booking_teacher_no_show_at',
'b.lesson_amount AS booking_lesson_amount',
'b.platform_fee_amount AS booking_platform_fee_amount',
'b.stripe_fee_amount AS booking_stripe_fee_amount',
'b.total_amount AS booking_total_amount',
'b.teacher_payout_amount AS booking_teacher_payout_amount',

      `CASE
        WHEN b.status IN ('CONFIRMED', 'COMPLETED', 'LEARNER_NO_SHOW', 'DISPUTED') THEN ST_Y(s.location::geometry)
        ELSE NULL
      END AS session_lat`,

      `CASE
        WHEN b.status IN ('CONFIRMED', 'COMPLETED', 'LEARNER_NO_SHOW', 'DISPUTED') THEN ST_X(s.location::geometry)
        ELSE NULL
      END AS session_lng`,

      `CASE
        WHEN b.status IN ('CONFIRMED', 'COMPLETED', 'LEARNER_NO_SHOW', 'DISPUTED') THEN s.arrival_instructions
        ELSE NULL
      END AS session_arrival_instructions`,

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

  private getSessionLat(session: any): number | null {
  const coords = session?.location?.coordinates;

  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  return typeof coords[1] === 'number' ? coords[1] : null;
}

private getSessionLng(session: any): number | null {
  const coords = session?.location?.coordinates;

  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  return typeof coords[0] === 'number' ? coords[0] : null;
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
      completed_at: booking.completed_at,
disputed_at: booking.disputed_at,
dispute_reason: booking.dispute_reason,
learner_no_show_at: booking.learner_no_show_at,
teacher_no_show_at: booking.teacher_no_show_at,
      paid_at: booking.paid_at,
amount: booking.amount,
lesson_amount: booking.lesson_amount,
platform_fee_amount: booking.platform_fee_amount,
stripe_fee_amount: booking.stripe_fee_amount,
total_amount: booking.total_amount,
teacher_payout_amount: booking.teacher_payout_amount,
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
arrival_instructions:
  [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.LEARNER_NO_SHOW,
  BookingStatus.DISPUTED,
].includes(booking.status)
    ? booking.session.arrival_instructions
    : null,
session_lat:
  [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.LEARNER_NO_SHOW,
  BookingStatus.DISPUTED,
].includes(booking.status)
    ? this.getSessionLat(booking.session)
    : null,
session_lng:
  [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.LEARNER_NO_SHOW,
  BookingStatus.DISPUTED,
].includes(booking.status)
    ? this.getSessionLng(booking.session)
    : null,
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