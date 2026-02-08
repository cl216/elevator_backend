import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      throw new ForbiddenException('Only teachers can create sessions');
    }

    // 2️⃣ Load class
    const classEntity = await this.classesRepository.findOne({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new BadRequestException('Class not found');
    }

    const pointWKT = `POINT(${lng} ${lat})`;
    // 3️⃣ Create session (WKT for PostGIS)
    const session = this.sessionsRepository.create({
      class: classEntity,
      teacher: teacher,
      start_time,
      duration,
      max_participants,
  location: { type: 'Point', coordinates: [lng, lat] },
    price: classEntity.price, // ✅ copy price from class
    });

    // 4️⃣ Save
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
  ) {
    return this.sessionsRepository
      .createQueryBuilder('session')
      .select([
        'session.id AS session_id',
        'ST_Y(session.location::geometry) AS lat',
        'ST_X(session.location::geometry) AS lng',
      ])
      .where(
        `session.location && ST_MakeEnvelope(:west, :south, :east, :north, 4326)`,
        { north, south, east, west },
      )
      .getRawMany();
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
