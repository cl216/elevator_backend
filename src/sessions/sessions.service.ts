import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { stableOffsetCoordinates } from '../utils/location-offset';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Session,
  SessionStatus,
  SessionType,
} from '../sessions/entities/session.entity';
import { Class } from '../classes/entities/class.entity';
import { User } from '../users/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateTeacherSessionDto } from './dto/create-teacher-session.dto';
import { PrivateSessionRequest } from '../private-lessons/entities/private-lesson-request.entity';

const PRIMARY_CATEGORY_SLUGS = [
  'art',
  'music',
  'cooking',
  'language',
  'crafts',
];

const REVIEW_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
} as const;

type CreateSessionInternalInput = {
  teacher: User;
  title: string;
  category: string;
  description?: string | null;
  price: number;
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  start_time: Date;
  duration: number;
  max_participants: number;
  lat: number;
  lng: number;
  rough_location?: string | null;
  arrival_instructions?: string | null;
  session_type?: SessionType;
  private_request?: PrivateSessionRequest | null;
  private_invitee_user_id?: string | null;
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    public readonly sessionsRepository: Repository<Session>,

    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,

    private readonly notificationsService: NotificationsService,
  ) {}

  private async assertTeacherCanCreatePaidSessions(teacherId: string) {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    if (!teacher.teacherProfile.stripe_enabled) {
      throw new ForbiddenException(
        'Complete Stripe onboarding to create sessions and receive payouts',
      );
    }

    return teacher;
  }

  private async ensureNoOverlappingActiveSession(
    teacherId: string,
    start: Date,
    end: Date,
    excludeSessionId?: string,
  ) {
    const query = this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.teacher_id = :teacherId', { teacherId })
      .andWhere('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere('session.start_time < :newEnd', { newEnd: end })
      .andWhere('session.end_time > :newStart', { newStart: start });

    if (excludeSessionId) {
      query.andWhere('session.id != :excludeSessionId', { excludeSessionId });
    }

const overlappingSession = await query
  .leftJoinAndSelect("session.class", "class")
  .getOne();

if (overlappingSession) {
  throw new BadRequestException(
    `This overlaps with "${overlappingSession.class?.title ?? "another session"}" at ${overlappingSession.start_time}.`,
  );
}
  }

  async approveSessionForReview(sessionId: string) {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['teacher', 'class'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    session.reviewStatus = REVIEW_STATUS.ACTIVE;

    await this.sessionsRepository.save(session);

    await this.notificationsService.create({
      user_id: session.teacher.id,
      type: 'SESSION_APPROVED',
      title: 'Session approved',
      body: `Your session "${session.class.title}" is now live and visible to learners.`,
      payload: {
        session_id: session.id,
        review_status: REVIEW_STATUS.ACTIVE,
      },
    });

    return {
      success: true,
      message: 'Session approved successfully',
    };
  }

  async getMySessionById(sessionId: string, teacherId: string) {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['teacher', 'class'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.teacher.id !== teacherId) {
      throw new ForbiddenException('You can only view your own session');
    }

    const coordinates = (session.location as any)?.coordinates ?? [];
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);

    const bookingsCount = await this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.session_id = :sessionId', { sessionId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ['PENDING', 'CONFIRMED'],
      })
      .getCount();

    const image_urls = [
      session.class.image_url_1,
      session.class.image_url_2,
      session.class.image_url_3,
    ].filter(Boolean);

    return {
      id: session.id,
      class_id: session.class.id,
      start_time: session.start_time,
      duration: Number(session.duration),
      price: Number(session.price),
      max_participants: Number(session.max_participants),
      bookings_count: bookingsCount,
      status: session.status,
      review_status: session.reviewStatus,
      cancelled_at: session.cancelled_at ?? null,
      session_type: session.session_type ?? SessionType.GROUP,
      private_invitee_user_id: session.private_invitee_user_id ?? null,
      rough_location: session.rough_location ?? '',
      arrival_instructions: session.arrival_instructions ?? null,
      image_urls,
      lat,
      lng,
      class: {
        title: session.class.title ?? 'Session',
        description: session.class.description ?? null,
        category: session.class.category ?? null,
      },
      teacher: {
        id: session.teacher.id,
      },
    };
  }

  async rejectSessionForReview(sessionId: string, reason?: string) {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['teacher', 'class'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    const trimmedReason = reason?.trim() || null;

    session.reviewStatus = REVIEW_STATUS.REJECTED;

    await this.sessionsRepository.save(session);

    await this.notificationsService.create({
      user_id: session.teacher.id,
      type: 'SESSION_REJECTED',
      title: 'Session needs changes',
      body: trimmedReason
        ? `Your session "${session.class.title}" was not approved. Reason: ${trimmedReason}`
        : `Your session "${session.class.title}" was not approved. Please review the details and submit again.`,
      payload: {
        session_id: session.id,
        review_status: REVIEW_STATUS.REJECTED,
        reason: trimmedReason,
      },
    });

    return {
      success: true,
      message: 'Session rejected successfully',
    };
  }

  async getPendingReviewSessions() {
    return this.sessionsRepository
      .createQueryBuilder('session')
      .leftJoin('session.class', 'class')
      .leftJoin('session.teacher', 'teacher')
      .select([
        'session.id AS id',
        'session.start_time AS start_time',
        'session.price AS price',
        'session.reviewStatus AS review_status',
        'class.title AS title',
        'class.category AS category',
        'teacher.id AS teacher_id',
      ])
      .where('session.reviewStatus = :status', {
        status: REVIEW_STATUS.PENDING_REVIEW,
      })
      .orderBy('session.start_time', 'ASC')
      .getRawMany();
  }

  private async createSessionWithClass(
    input: CreateSessionInternalInput,
  ): Promise<Session> {
    const title = input.title?.trim();
    const category = input.category?.trim();
    const description = input.description?.trim() || null;
    const roughLocation = input.rough_location?.trim() || null;
    const arrivalInstructions = input.arrival_instructions?.trim() || null;

    const sessionType = input.session_type ?? SessionType.GROUP;

    if (!title) {
      throw new BadRequestException('Title is required');
    }

    if (!category) {
      throw new BadRequestException('Category is required');
    }

    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new BadRequestException('Invalid price');
    }

    if (!Number.isFinite(input.duration) || input.duration <= 0) {
      throw new BadRequestException('Invalid duration');
    }

    if (
      !Number.isFinite(input.max_participants) ||
      input.max_participants <= 0
    ) {
      throw new BadRequestException('Invalid max_participants');
    }

    if (sessionType === SessionType.PRIVATE && input.max_participants !== 1) {
      throw new BadRequestException(
        'Private sessions must have exactly 1 participant.',
      );
    }

    if (sessionType === SessionType.PRIVATE && !input.private_invitee_user_id) {
      throw new BadRequestException(
        'Private sessions require an invited learner.',
      );
    }

    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      throw new BadRequestException('Invalid location');
    }

    if (!roughLocation) {
      throw new BadRequestException('Public location is required');
    }

    if (arrivalInstructions && arrivalInstructions.length > 300) {
      throw new BadRequestException(
        'Arrival instructions must be 300 characters or fewer',
      );
    }

    if (
      !(input.start_time instanceof Date) ||
      isNaN(input.start_time.getTime())
    ) {
      throw new BadRequestException('Invalid start_time');
    }

    if (input.start_time <= new Date()) {
      throw new BadRequestException('Session must be in the future');
    }

    const endTime = new Date(
      input.start_time.getTime() + input.duration * 60_000,
    );

    await this.ensureNoOverlappingActiveSession(
      input.teacher.id,
      input.start_time,
      endTime,
    );

    const classEntity = this.classesRepository.create({
      teacher: input.teacher,
      title,
      category,
      description,
      priceCents: Math.round(input.price * 100),
      image_url_1: input.image_url_1?.trim() || null,
      image_url_2: input.image_url_2?.trim() || null,
      image_url_3: input.image_url_3?.trim() || null,
    });

    const savedClass = await this.classesRepository.save(classEntity);

    const session = this.sessionsRepository.create({
      class: savedClass,
      teacher: input.teacher,
      start_time: input.start_time,
      duration: input.duration,
      end_time: endTime,
      max_participants:
        sessionType === SessionType.PRIVATE ? 1 : input.max_participants,
      location: {
        type: 'Point',
        coordinates: [input.lng, input.lat],
      },
      price: input.price,
      rough_location: roughLocation,
      arrival_instructions: arrivalInstructions,
      status: SessionStatus.ACTIVE,
reviewStatus: REVIEW_STATUS.PENDING_REVIEW,
      cancelled_at: null,
      session_type: sessionType,
      private_request: input.private_request ?? null,
      private_invitee_user_id:
        sessionType === SessionType.PRIVATE
          ? input.private_invitee_user_id
          : null,
    });

    return this.sessionsRepository.save(session);
  }

  async createTeacherSessionFromSingleForm(
    teacherId: string,
    dto: CreateTeacherSessionDto,
  ): Promise<Session> {
    const teacher = await this.assertTeacherCanCreatePaidSessions(teacherId);

    const start = new Date(dto.start_time);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start_time');
    }

    return this.createSessionWithClass({
      teacher,
      title: dto.title,
      category: dto.category,
      description: dto.description ?? null,
      price: dto.price,
      image_url_1: dto.image_url_1 ?? null,
      image_url_2: dto.image_url_2 ?? null,
      image_url_3: dto.image_url_3 ?? null,
      start_time: start,
      duration: dto.duration,
      max_participants: dto.max_participants,
      lat: dto.lat,
      lng: dto.lng,
      rough_location: dto.rough_location ?? null,
      arrival_instructions: dto.arrival_instructions ?? null,
      session_type: SessionType.GROUP,
      private_request: null,
      private_invitee_user_id: null,
    });
  }

  async createAcceptedPrivateSession(params: {
    teacherId: string;
    privateRequest: PrivateSessionRequest;
    title: string;
    category: string;
    description?: string | null;
    price: number;
    start_time: string;
    duration: number;
    lat: number;
    lng: number;
    rough_location: string;
    arrival_instructions?: string | null;
  }): Promise<Session> {
    const teacher = await this.assertTeacherCanCreatePaidSessions(
      params.teacherId,
    );

    const start = new Date(params.start_time);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start_time');
    }

    const learnerId = params.privateRequest.learner?.id;

    if (!learnerId) {
      throw new BadRequestException(
        'Cannot create private session without the requesting learner.',
      );
    }

    return this.createSessionWithClass({
      teacher,
      title: params.title,
      category: params.category,
      description: params.description ?? null,
      price: params.price,
      image_url_1: null,
      image_url_2: null,
      image_url_3: null,
      start_time: start,
      duration: params.duration,
      max_participants: 1,
      lat: params.lat,
      lng: params.lng,
      rough_location: params.rough_location,
      arrival_instructions: params.arrival_instructions ?? null,
      session_type: SessionType.PRIVATE,
      private_request: params.privateRequest,
      private_invitee_user_id: learnerId,
    });
  }

  async updateSession(
    sessionId: string,
    teacherId: string,
    dto: UpdateSessionDto,
  ): Promise<Session> {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['teacher', 'class'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.teacher.id !== teacherId) {
      throw new ForbiddenException('You can only update your own sessions');
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('Cancelled sessions cannot be edited');
    }

    const nextStart =
      typeof dto.start_time === 'string'
        ? new Date(dto.start_time)
        : new Date(session.start_time);

    if (isNaN(nextStart.getTime())) {
      throw new BadRequestException('Invalid start_time');
    }

    const nextDuration =
      typeof dto.duration === 'number' ? dto.duration : session.duration;

    if (!Number.isFinite(nextDuration) || nextDuration <= 0) {
      throw new BadRequestException('Invalid duration');
    }

    const nextMaxParticipants =
      session.session_type === SessionType.PRIVATE
        ? 1
        : typeof dto.max_participants === 'number'
          ? dto.max_participants
          : session.max_participants;

    if (!Number.isFinite(nextMaxParticipants) || nextMaxParticipants <= 0) {
      throw new BadRequestException('Invalid max_participants');
    }

    const nextPrice =
      typeof dto.price === 'number' ? dto.price : Number(session.price);

    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      throw new BadRequestException('Invalid price');
    }

    if (nextStart <= new Date()) {
      throw new BadRequestException('Session must be in the future');
    }

    const nextEnd = new Date(nextStart.getTime() + nextDuration * 60_000);

    await this.ensureNoOverlappingActiveSession(
      teacherId,
      nextStart,
      nextEnd,
      sessionId,
    );

    session.start_time = nextStart;
    session.end_time = nextEnd;
    session.duration = nextDuration;
    session.max_participants = nextMaxParticipants;
    session.price = nextPrice;

    if (
      typeof dto.lat === 'number' &&
      Number.isFinite(dto.lat) &&
      typeof dto.lng === 'number' &&
      Number.isFinite(dto.lng)
    ) {
      session.location = {
        type: 'Point',
        coordinates: [dto.lng, dto.lat],
      };
    }

    if (typeof dto.rough_location === 'string') {
      session.rough_location = dto.rough_location.trim() || null;
    }

    if (typeof dto.arrival_instructions === 'string') {
      const trimmedInstructions = dto.arrival_instructions.trim();

      if (trimmedInstructions.length > 300) {
        throw new BadRequestException(
          'Arrival instructions must be 300 characters or fewer',
        );
      }

      session.arrival_instructions = trimmedInstructions || null;
    }

    if (typeof dto.title === 'string') {
      const trimmed = dto.title.trim();
      if (!trimmed) {
        throw new BadRequestException('Title is required');
      }
      session.class.title = trimmed;
    }

    if (typeof dto.category === 'string') {
      const trimmed = dto.category.trim();
      if (!trimmed) {
        throw new BadRequestException('Category is required');
      }
      session.class.category = trimmed;
    }

    if (typeof dto.description === 'string') {
      session.class.description = dto.description.trim() || null;
    }

    if (typeof dto.price === 'number') {
      session.class.priceCents = Math.round(dto.price * 100);
    }

    if (typeof dto.image_url_1 === 'string') {
      session.class.image_url_1 = dto.image_url_1.trim() || null;
    }

    if (typeof dto.image_url_2 === 'string') {
      session.class.image_url_2 = dto.image_url_2.trim() || null;
    }

    if (typeof dto.image_url_3 === 'string') {
      session.class.image_url_3 = dto.image_url_3.trim() || null;
    }

session.reviewStatus = REVIEW_STATUS.PENDING_REVIEW;

    await this.classesRepository.save(session.class);

    return this.sessionsRepository.save(session);
  }

  async duplicateSession(
    sessionId: string,
    teacherId: string,
    newStartTime: Date,
  ): Promise<Session> {
    const original = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['class', 'teacher'],
    });

    if (!original) {
      throw new BadRequestException('Original session not found');
    }

    if (original.teacher.id !== teacherId) {
      throw new ForbiddenException('You can only duplicate your own sessions');
    }

    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    if (!teacher.teacherProfile.stripe_enabled) {
      throw new ForbiddenException(
        'Complete Stripe onboarding to create sessions and receive payouts',
      );
    }

    const start = new Date(newStartTime);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start_time');
    }

    if (start <= new Date()) {
      throw new BadRequestException('New session must be in the future');
    }

    const endTime = new Date(start.getTime() + original.duration * 60_000);

    await this.ensureNoOverlappingActiveSession(teacherId, start, endTime);

    const duplicated = this.sessionsRepository.create({
      class: original.class,
      teacher: original.teacher,
      start_time: start,
      end_time: endTime,
      duration: original.duration,
reviewStatus: REVIEW_STATUS.PENDING_REVIEW,
      max_participants:
        original.session_type === SessionType.PRIVATE
          ? 6
          : original.max_participants,
      price: original.price,
      location: original.location,
      rough_location: original.rough_location ?? null,
      arrival_instructions: original.arrival_instructions ?? null,
      status: SessionStatus.ACTIVE,
      cancelled_at: null,
      session_type: SessionType.GROUP,
      private_request: null,
      private_invitee_user_id: null,
    });

    return this.sessionsRepository.save(duplicated);
  }

  async updateArrivalInstructions(
    sessionId: string,
    teacherId: string,
    instructions: string,
  ): Promise<Session> {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['teacher'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.teacher.id !== teacherId) {
      throw new ForbiddenException(
        'You can only update arrival instructions for your own sessions',
      );
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('Cancelled sessions cannot be edited');
    }

    const trimmedInstructions = instructions?.trim() ?? '';

    if (trimmedInstructions.length > 300) {
      throw new BadRequestException(
        'Arrival instructions must be 300 characters or fewer',
      );
    }

    session.arrival_instructions = trimmedInstructions || null;

    return this.sessionsRepository.save(session);
  }

  async cancelSession(sessionId: string, teacherId: string) {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['teacher'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.teacher.id !== teacherId) {
      throw new ForbiddenException('You can only cancel your own sessions');
    }

    if (session.status === SessionStatus.CANCELLED) {
      return { message: 'Session already cancelled' };
    }

    session.status = SessionStatus.CANCELLED;
    session.cancelled_at = new Date();

    await this.sessionsRepository.save(session);

    return { message: 'Session cancelled successfully' };
  }

  async getSessionsForMap(
    north: number,
    south: number,
    east: number,
    west: number,
    category?: string,
  ) {
    const query = this.sessionsRepository
      .createQueryBuilder('session')
      .leftJoin('session.class', 'class')
      .leftJoin('teacher_profiles', 'tp', 'tp.user_id = session.teacher_id')
      .select([
        'session.id AS session_id',
        'ST_Y(session.location::geometry) AS lat',
        'ST_X(session.location::geometry) AS lng',
        'class.title AS title',
        'class.category AS category',
        'session.price AS price',
        'session.start_time AS start_time',
        'tp.full_name AS teacher_name',
        'tp.image_url AS teacher_avatar_url',
        'session.session_type AS session_type',
      ])
      .where(
        `(session.location::geometry) && ST_MakeEnvelope(:west, :south, :east, :north, 4326)`,
        { north, south, east, west },
      )
      .andWhere('session.start_time > NOW()')
      .andWhere('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere('session.reviewStatus = :reviewStatus', {
        reviewStatus: REVIEW_STATUS.ACTIVE,
      })
      .andWhere('session.session_type = :sessionType', {
        sessionType: SessionType.GROUP,
      });

    if (category && category !== 'all') {
      if (category === 'other') {
        query.andWhere('class.category NOT IN (:...primaryCategories)', {
          primaryCategories: PRIMARY_CATEGORY_SLUGS,
        });
      } else {
        query.andWhere('class.category = :category', { category });
      }
    }

    const sessions = await query.getRawMany();

    return sessions.map((session) => {
      const lat = Number(session.lat);
      const lng = Number(session.lng);

      const offset = stableOffsetCoordinates(
        session.session_id,
        lat,
        lng,
        50,
      );

      return {
        ...session,
        lat: offset.lat,
        lng: offset.lng,
      };
    });
  }

  async getSessionById(sessionId: string) {
    const sessionRow = await this.sessionsRepository
      .createQueryBuilder('session')
      .leftJoin('session.class', 'class')
      .leftJoin('teacher_profiles', 'tp', 'tp.user_id = session.teacher_id')
      .select([
        'session.id AS id',
        'session.start_time AS start_time',
        'session.duration AS duration',
        'session.max_participants AS max_participants',
        'session.price AS price',
        'session.rough_location AS rough_location',
        'session.arrival_instructions AS arrival_instructions',
        'session.status AS status',
        'session.reviewStatus AS review_status',
        'session.cancelled_at AS cancelled_at',
        'session.session_type AS session_type',
        'session.private_invitee_user_id AS private_invitee_user_id',
        'ST_Y(session.location::geometry) AS lat',
        'ST_X(session.location::geometry) AS lng',
        'class.id AS class_id',
        'class.title AS class_title',
        'class.description AS class_description',
        'class.category AS class_category',
        'class.image_url_1 AS image_url_1',
        'class.image_url_2 AS image_url_2',
        'class.image_url_3 AS image_url_3',
        'session.teacher_id AS teacher_id',
        'tp.full_name AS teacher_name',
        'tp.image_url AS teacher_avatar_url',
      ])
      .where('session.id = :sessionId', { sessionId })
      .getRawOne();

    if (!sessionRow) {
      throw new BadRequestException('Session not found');
    }

    if (
      sessionRow.session_type === SessionType.GROUP &&
      sessionRow.review_status !== REVIEW_STATUS.ACTIVE
    ) {
      throw new BadRequestException('Session not found');
    }

    const bookingsQuery = this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.session_id = :sessionId', { sessionId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ['PENDING', 'CONFIRMED'],
      });

    if (
      sessionRow.session_type === SessionType.PRIVATE &&
      sessionRow.private_invitee_user_id
    ) {
      bookingsQuery.andWhere('booking.user_id = :inviteeUserId', {
        inviteeUserId: sessionRow.private_invitee_user_id,
      });
    }

    const bookingsCount = await bookingsQuery.getCount();

    const attendeeRowsQuery = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.user', 'user')
      .select([
        'user.id AS id',
        'user.first_name AS first_name',
        'user.image_url AS image_url',
        'booking.createdAt AS created_at',
      ])
      .where('booking.session_id = :sessionId', { sessionId })
      .andWhere('booking.status = :confirmedStatus', {
        confirmedStatus: 'CONFIRMED',
      })
      .orderBy('booking.createdAt', 'ASC');

    if (
      sessionRow.session_type === SessionType.PRIVATE &&
      sessionRow.private_invitee_user_id
    ) {
      attendeeRowsQuery.andWhere('booking.user_id = :inviteeUserId', {
        inviteeUserId: sessionRow.private_invitee_user_id,
      });
    }

    const attendeeRows = await attendeeRowsQuery.getRawMany();

    const attendees = attendeeRows
      .map((row) => ({
        id: String(row.id ?? ''),
        first_name: String(row.first_name ?? '').trim(),
        image_url: row.image_url ?? null,
      }))
      .filter((attendee) => attendee.id && attendee.first_name);

    const attendee_first_names = attendees
      .slice(0, 3)
      .map((attendee) => attendee.first_name);

    const spotsLeft = Math.max(
      0,
      Number(sessionRow.max_participants) - bookingsCount,
    );

    const image_urls = [
      sessionRow.image_url_1,
      sessionRow.image_url_2,
      sessionRow.image_url_3,
    ].filter(Boolean);

    return {
      id: sessionRow.id,
      class_id: sessionRow.class_id,
      start_time: sessionRow.start_time,
      duration: Number(sessionRow.duration),
      price: Number(sessionRow.price),
      max_participants: Number(sessionRow.max_participants),
      bookings_count: bookingsCount,
      confirmed_attendees_count: attendees.length,
      spots_left: spotsLeft,
      attendee_first_names,
      attendees,
      status: sessionRow.status,
      review_status: sessionRow.review_status,
      cancelled_at: sessionRow.cancelled_at ?? null,
      session_type: sessionRow.session_type ?? SessionType.GROUP,
      private_invitee_user_id: sessionRow.private_invitee_user_id ?? null,
      rough_location:
        sessionRow.rough_location ?? 'Exact location shared after booking',
arrival_instructions: null,
      image_urls,
      lat: Number(sessionRow.lat),
      lng: Number(sessionRow.lng),
      class: {
        title: sessionRow.class_title ?? 'Session',
        description: sessionRow.class_description ?? null,
        category: sessionRow.class_category ?? null,
      },
      teacher: {
        id: sessionRow.teacher_id,
        name: sessionRow.teacher_name ?? 'Teacher',
        avatarUrl: sessionRow.teacher_avatar_url ?? null,
      },
    };
  }

  async getMySessions(teacherId: string) {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    return this.sessionsRepository
      .createQueryBuilder('session')
      .leftJoin('session.class', 'class')
      .leftJoin(Booking, 'booking', 'booking.session_id = session.id')
      .select([
        'session.id AS id',
        'session.start_time AS start_time',
        'session.end_time AS end_time',
        'session.duration AS duration',
        'session.max_participants AS max_participants',
        'session.price AS price',
        'session.rough_location AS rough_location',
        'session.status AS status',
        'session.reviewStatus AS review_status',
        'session.cancelled_at AS cancelled_at',
        'session.session_type AS session_type',
        'session.private_invitee_user_id AS private_invitee_user_id',
        'class.title AS title',
        'class.category AS category',
      ])
      .addSelect(
        `COUNT(CASE WHEN booking.status IN ('PENDING', 'CONFIRMED') THEN 1 END)`,
        'bookings_count',
      )
      .where('session.teacher_id = :teacherId', { teacherId })
      .groupBy('session.id')
      .addGroupBy('class.title')
      .addGroupBy('class.category')
      .orderBy('session.start_time', 'ASC')
      .getRawMany();
  }

  async getSessionBookings(sessionId: string, teacherId: string) {
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['teacher', 'class'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.teacher.id !== teacherId) {
      throw new ForbiddenException(
        'You can only view bookings for your own sessions',
      );
    }

    const bookingsQuery = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.user', 'user')
      .select([
        'booking.id AS id',
        'booking.status AS status',
        'booking.intro_message AS intro_message',
        'booking.createdAt AS created_at',
        'user.id AS learner_id',
        'user.first_name AS learner_first_name',
        'user.image_url AS learner_image_url',
      ])
      .where('booking.session_id = :sessionId', { sessionId })
      .orderBy('booking.createdAt', 'DESC');

    if (
      session.session_type === SessionType.PRIVATE &&
      session.private_invitee_user_id
    ) {
      bookingsQuery.andWhere('booking.user_id = :inviteeUserId', {
        inviteeUserId: session.private_invitee_user_id,
      });
    }

    const bookings = await bookingsQuery.getRawMany();

    return {
      session: {
        id: session.id,
        title: session.class.title,
        start_time: session.start_time,
        duration: session.duration,
        max_participants: session.max_participants,
        price: session.price,
        arrival_instructions: session.arrival_instructions ?? null,
        status: session.status,
        review_status: session.reviewStatus,
        cancelled_at: session.cancelled_at ?? null,
        session_type: session.session_type ?? SessionType.GROUP,
        private_invitee_user_id: session.private_invitee_user_id ?? null,
      },
      bookings,
    };
  }

  async getNearbySessions(
    lat: number,
    lng: number,
    limit = 3,
    category?: string,
  ) {
    const query = this.sessionsRepository
      .createQueryBuilder('session')
      .leftJoin('session.class', 'class')
      .leftJoin('teacher_profiles', 'tp', 'tp.user_id = session.teacher_id')
      .select([
        'session.id AS session_id',
        'ST_Y(session.location::geometry) AS lat',
        'ST_X(session.location::geometry) AS lng',
        'class.title AS title',
        'class.category AS category',
        'session.price AS price',
        'session.start_time AS start_time',
        'tp.full_name AS teacher_name',
        'tp.image_url AS teacher_avatar_url',
        `ST_Distance(
          session.location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        ) AS distance_meters`,
      ])
      .where('session.start_time > NOW()')
      .andWhere('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere('session.reviewStatus = :reviewStatus', {
        reviewStatus: REVIEW_STATUS.ACTIVE,
      })
      .andWhere('session.session_type = :sessionType', {
        sessionType: SessionType.GROUP,
      })
      .andWhere(
        `ST_DWithin(
          session.location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radiusMeters
        )`,
        { radiusMeters: 20_000 },
      )
      .setParameters({ lat, lng });

    if (category && category !== 'all') {
      if (category === 'other') {
        query.andWhere('class.category NOT IN (:...primaryCategories)', {
          primaryCategories: PRIMARY_CATEGORY_SLUGS,
        });
      } else {
        query.andWhere('class.category = :category', { category });
      }
    }

    const rows = await query
      .orderBy('distance_meters', 'ASC')
      .limit(limit)
      .getRawMany();

    return rows.map((row) => ({
      session_id: row.session_id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      title: row.title ?? 'Session',
      category: row.category ?? 'other',
      price: Number(row.price ?? 0),
      start_time: row.start_time,
      teacher_name: row.teacher_name ?? 'Teacher',
      teacher_avatar_url: row.teacher_avatar_url ?? null,
      distance_meters: Math.round(Number(row.distance_meters ?? 0)),
    }));
  }
}