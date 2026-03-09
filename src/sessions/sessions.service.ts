import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { stableOffsetCoordinates } from '../utils/location-offset';
import { Session } from '../sessions/entities/session.entity';
import { Class } from '../classes/entities/class.entity';
import { User } from '../users/user.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,

    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Create a session (teacher only)
   */
  async createSession(
    teacherId: string,
    classId: string,
    start_time: Date,
    duration: number,
    max_participants: number,
    lat: number,
    lng: number,
  ): Promise<Session> {
    // 1️⃣ Load teacher
    const teacher = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      throw new ForbiddenException('Only teachers can create sessions');
    }

    if (!teacher.teacherProfile?.stripe_enabled) {
      throw new ForbiddenException(
        'Complete Stripe onboarding to create sessions and receive payouts',
      );
    }

    // 2️⃣ Load class
    const classEntity = await this.classesRepository.findOne({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new BadRequestException('Class not found');
    }

    const start = new Date(start_time);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new BadRequestException('Invalid duration');
    }
    const end_time = new Date(start.getTime() + duration * 60_000);

    const pointWKT = `POINT(${lng} ${lat})`;
    // 3️⃣ Create session (WKT for PostGIS)
    const session = this.sessionsRepository.create({
      class: classEntity,
      teacher: teacher,
      start_time,
      duration,
      end_time,
      max_participants,
      location: { type: 'Point', coordinates: [lng, lat] },
      price: classEntity.price, // ✅ copy price from class
    });

    // 4️⃣ Save
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

    if (!teacher || teacher.role !== 'TEACHER') {
      throw new ForbiddenException('Only teachers can duplicate sessions');
    }

    if (!teacher.teacherProfile?.stripe_enabled) {
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

    const end_time = new Date(start.getTime() + original.duration * 60_000);

    const duplicated = this.sessionsRepository.create({
      class: original.class,
      teacher: original.teacher,
      start_time: start,
      end_time,
      duration: original.duration,
      max_participants: original.max_participants,
      price: original.price,
      location: original.location,
    });

    return this.sessionsRepository.save(duplicated);
  }

  async updateArrivalInstructions(
    sessionId: string,
    teacherId: string,
    instructions: string,
  ): Promise<Session> {
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

    const trimmedInstructions = instructions?.trim() ?? '';

    if (trimmedInstructions.length > 300) {
      throw new BadRequestException(
        'Arrival instructions must be 300 characters or fewer',
      );
    }

    session.arrival_instructions = trimmedInstructions || null;

    return this.sessionsRepository.save(session);
  }

  /**
   * Get sessions for map viewport (Step 7)
   */
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
      );

    if (category && category !== 'all') {
      query.andWhere('class.category = :category', { category });
    }

    const sessions = await query.getRawMany();

    return sessions.map((session) => {
      const lat = Number(session.lat);
      const lng = Number(session.lng);

      const offset = stableOffsetCoordinates(
        session.session_id,
        lat,
        lng,
        100, // 100 meter max offset
      );

      return {
        ...session,
        lat: offset.lat,
        lng: offset.lng,
      };
    });
  }

  /**
   * Get full session details (tap marker)
   */
  async getSessionById(sessionId: string): Promise<Session> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['class', 'teacher'],
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    return session;
  }
}
