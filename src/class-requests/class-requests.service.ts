import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassRequest } from './class-request.entity';
import { User } from '../users/user.entity';
import { CreateClassRequestDto } from './dto/create-class-request.dto';
import { Session } from '../sessions/entities/session.entity';

@Injectable()
export class ClassRequestsService {
  constructor(
    @InjectRepository(ClassRequest)
    private readonly classRequestsRepository: Repository<ClassRequest>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
  ) {}

  async create(userId: string, dto: CreateClassRequestDto) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

if (dto.request_type === 'new_class') {
  const existingRecentNewClassRequest = await this.classRequestsRepository
    .createQueryBuilder('cr')
    .where('cr.user_id = :userId', { userId })
    .andWhere('cr.request_type = :requestType', {
      requestType: 'new_class',
    })
    .andWhere(`cr.created_at >= NOW() - INTERVAL '7 days'`)
    .getOne();

  if (existingRecentNewClassRequest) {
    throw new BadRequestException(
      'You can only suggest one new class every week.',
    );
  }
}

    const note = dto.note?.trim() || null;
    const customTitle = dto.custom_title?.trim() || null;

    if (dto.request_type === 'existing_category' && !dto.category) {
      throw new BadRequestException('Category is required');
    }

    if (dto.request_type === 'new_class' && !customTitle) {
      throw new BadRequestException('Custom class title is required');
    }

    const classRequest = this.classRequestsRepository.create({
      user,
      request_type: dto.request_type,
      category:
        dto.request_type === 'existing_category' ? dto.category ?? null : null,
      custom_title: dto.request_type === 'new_class' ? customTitle : null,
      note,
      review_status:
        dto.request_type === 'new_class' ? 'pending' : 'approved',
      lat: dto.lat,
      lng: dto.lng,
    });

    const saved = await this.classRequestsRepository.save(classRequest);

    return {
      id: saved.id,
      message:
        dto.request_type === 'new_class'
          ? 'Class idea submitted for review'
          : 'Class request created',
    };
  }

  async getNearbyDemandForTeacher(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { teacherProfile: true } as any,
    });

    if (!user?.teacherProfile) {
      throw new BadRequestException('Teacher profile required');
    }

    const teacherSessions = await this.sessionsRepository
      .createQueryBuilder('session')
      .select([
        'ST_Y(session.location::geometry) AS lat',
        'ST_X(session.location::geometry) AS lng',
      ])
      .where('session.teacher_id = :userId', { userId })
      .orderBy('session.start_time', 'DESC')
      .limit(20)
      .getRawMany();

    if (teacherSessions.length === 0) {
      return {
        existing_categories: [],
        custom_ideas: [],
      };
    }

    const avgLat =
      teacherSessions.reduce((sum, row) => sum + Number(row.lat), 0) /
      teacherSessions.length;

    const avgLng =
      teacherSessions.reduce((sum, row) => sum + Number(row.lng), 0) /
      teacherSessions.length;

    const existingCategoryRows = await this.classRequestsRepository
      .createQueryBuilder('cr')
      .select('cr.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('cr.request_type = :requestType', {
        requestType: 'existing_category',
      })
      .andWhere('cr.review_status = :reviewStatus', {
        reviewStatus: 'approved',
      })
      .andWhere(
        `
        SQRT(
          POWER((cr.lat - :avgLat) * 111000, 2) +
          POWER(
            (cr.lng - :avgLng) * 111000 * COS((:avgLat * PI()) / 180),
            2
          )
        ) <= :radiusMeters
        `,
        {
          avgLat,
          avgLng,
          radiusMeters: 10000,
        },
      )
      .groupBy('cr.category')
      .orderBy('count', 'DESC')
      .getRawMany();

const customIdeaRows = await this.classRequestsRepository
  .createQueryBuilder('cr')
  .select('cr.custom_title', 'custom_title')
  .addSelect('COUNT(*)', 'count')
  .where('cr.request_type = :requestType', {
    requestType: 'new_class',
  })
  .andWhere('cr.review_status = :reviewStatus', {
    reviewStatus: 'approved',
  })
      .andWhere(
        `
        SQRT(
          POWER((cr.lat - :avgLat) * 111000, 2) +
          POWER(
            (cr.lng - :avgLng) * 111000 * COS((:avgLat * PI()) / 180),
            2
          )
        ) <= :radiusMeters
        `,
        {
          avgLat,
          avgLng,
          radiusMeters: 10000,
        },
      )
      .groupBy('cr.custom_title')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      existing_categories: existingCategoryRows.map((row) => ({
        category: row.category,
        count: Number(row.count),
      })),
      custom_ideas: customIdeaRows.map((row) => ({
        custom_title: row.custom_title,
        count: Number(row.count),
      })),
    };
  }
}