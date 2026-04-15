import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { stableOffsetCoordinates } from '../utils/location-offset';
import { Session, SessionStatus } from '../sessions/entities/session.entity';
import { Class } from '../classes/entities/class.entity';
import { User } from '../users/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateTeacherSessionDto } from './dto/create-teacher-session.dto';

const PRIMARY_CATEGORY_SLUGS = [
  'art',
  'music',
  'cooking',
  'language',
  'crafts',
];

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,

    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  async createTeacherSessionFromSingleForm(
    teacherId: string,
    dto: CreateTeacherSessionDto,
  ): Promise<Session> {
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

    const title = dto.title?.trim();
    const category = dto.category?.trim();
    const description = dto.description?.trim() || null;
    const roughLocation = dto.rough_location?.trim() || null;
    const arrivalInstructions = dto.arrival_instructions?.trim() || null;

    if (!title) {
      throw new BadRequestException('Title is required');
    }

    if (!category) {
      throw new BadRequestException('Category is required');
    }

    if (!Number.isFinite(dto.price) || dto.price <= 0) {
      throw new BadRequestException('Invalid price');
    }

    if (!Number.isFinite(dto.duration) || dto.duration <= 0) {
      throw new BadRequestException('Invalid duration');
    }

    if (!Number.isFinite(dto.max_participants) || dto.max_participants <= 0) {
      throw new BadRequestException('Invalid max_participants');
    }

    if (!Number.isFinite(dto.lat) || !Number.isFinite(dto.lng)) {
      throw new BadRequestException('Invalid location');
    }

    if (arrivalInstructions && arrivalInstructions.length > 300) {
      throw new BadRequestException(
        'Arrival instructions must be 300 characters or fewer',
      );
    }

    const start = new Date(dto.start_time);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start_time');
    }

    if (start <= new Date()) {
      throw new BadRequestException('Session must be in the future');
    }

    const endTime = new Date(start.getTime() + dto.duration * 60_000);

    const overlappingSession = await this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.teacher_id = :teacherId', { teacherId })
      .andWhere('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere('session.start_time < :newEnd', { newEnd: endTime })
      .andWhere('session.end_time > :newStart', { newStart: start })
      .getOne();

    if (overlappingSession) {
      throw new BadRequestException(
        'You already have another session that overlaps with this time.',
      );
    }

    const classEntity = this.classesRepository.create({
      teacher,
      title,
      category,
      description,
      price: dto.price,
      image_url_1: dto.image_url_1?.trim() || null,
      image_url_2: dto.image_url_2?.trim() || null,
      image_url_3: dto.image_url_3?.trim() || null,
    });

    const savedClass = await this.classesRepository.save(classEntity);

    const session = this.sessionsRepository.create({
      class: savedClass,
      teacher,
      start_time: start,
      duration: dto.duration,
      end_time: endTime,
      max_participants: dto.max_participants,
      location: {
        type: 'Point',
        coordinates: [dto.lng, dto.lat],
      },
      price: dto.price,
      rough_location: roughLocation,
      arrival_instructions: arrivalInstructions,
      status: SessionStatus.ACTIVE,
      cancelled_at: null,
    });

    return this.sessionsRepository.save(session);
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
      typeof dto.max_participants === 'number'
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

    const overlappingSession = await this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.teacher_id = :teacherId', { teacherId })
      .andWhere('session.id != :sessionId', { sessionId })
      .andWhere('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere('session.start_time < :newEnd', { newEnd: nextEnd })
      .andWhere('session.end_time > :newStart', { newStart: nextStart })
      .getOne();

    if (overlappingSession) {
      throw new BadRequestException(
        'You already have another session that overlaps with this time.',
      );
    }

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
      session.class.price = dto.price;
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

    const overlappingSession = await this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.teacher_id = :teacherId', { teacherId })
      .andWhere('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere('session.start_time < :newEnd', { newEnd: endTime })
      .andWhere('session.end_time > :newStart', { newStart: start })
      .getOne();

    if (overlappingSession) {
      throw new BadRequestException(
        'You already have another session that overlaps with this time.',
      );
    }

    const duplicated = this.sessionsRepository.create({
      class: original.class,
      teacher: original.teacher,
      start_time: start,
      end_time: endTime,
      duration: original.duration,
      max_participants: original.max_participants,
      price: original.price,
      location: original.location,
      rough_location: original.rough_location ?? null,
      arrival_instructions: original.arrival_instructions ?? null,
      status: SessionStatus.ACTIVE,
      cancelled_at: null,
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
      ])
      .where(
        `(session.location::geometry) && ST_MakeEnvelope(:west, :south, :east, :north, 4326)`,
        { north, south, east, west },
      )
      .andWhere('session.start_time > NOW()')
      .andWhere('session.status = :status', { status: SessionStatus.ACTIVE });

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
        100,
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
        'session.cancelled_at AS cancelled_at',
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

    const bookingsCount = await this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.session_id = :sessionId', { sessionId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ['PENDING', 'CONFIRMED'],
      })
      .getCount();

    const attendeeRows = await this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.user', 'user')
      .select([
        'user.first_name AS first_name',
        'booking.createdAt AS created_at',
      ])
      .where('booking.session_id = :sessionId', { sessionId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ['PENDING', 'CONFIRMED'],
      })
      .orderBy('booking.createdAt', 'ASC')
      .limit(3)
      .getRawMany();

    const attendee_first_names = attendeeRows
      .map((row) => (row.first_name ?? '').trim())
      .filter(Boolean);

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
      spots_left: spotsLeft,
      attendee_first_names,
      status: sessionRow.status,
      cancelled_at: sessionRow.cancelled_at ?? null,
      rough_location:
        sessionRow.rough_location ?? 'Exact location shared after booking',
      arrival_instructions: sessionRow.arrival_instructions ?? null,
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
        'session.cancelled_at AS cancelled_at',
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

    const bookings = await this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.user', 'user')
      .select([
        'booking.id AS id',
        'booking.status AS status',
        'booking.intro_message AS intro_message',
        'booking.createdAt AS created_at',
        'user.id AS learner_id',
        'user.first_name AS learner_first_name',
      ])
      .where('booking.session_id = :sessionId', { sessionId })
      .orderBy('booking.createdAt', 'DESC')
      .getRawMany();

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
        cancelled_at: session.cancelled_at ?? null,
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