import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './entities/class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async createClass(user: User, dto: CreateClassDto) {
    const dbUser = await this.userRepository.findOne({
      where: { id: user.id },
      relations: { teacherProfile: true } as any,
    });

    if (!dbUser?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required to create classes');
    }

    const normalizedCategory = dto.category.trim().toLowerCase();

    const approvedCategory = await this.categoryRepository.findOne({
      where: {
        slug: normalizedCategory,
        status: 'approved',
      } as any,
    });

    if (!approvedCategory) {
      throw new BadRequestException('Category is not approved');
    }

    const newClass = this.classRepository.create({
      title: dto.title.trim(),
      category: approvedCategory.slug,
      description: dto.description?.trim() || undefined,
      priceCents: Math.round(dto.price * 100),
      image_url_1: dto.image_url_1?.trim() || null,
      image_url_2: dto.image_url_2?.trim() || null,
      image_url_3: dto.image_url_3?.trim() || null,
      teacher: dbUser,
    });

    return this.classRepository.save(newClass);
  }

  async updateClass(classId: string, user: User, dto: UpdateClassDto) {
    const dbUser = await this.userRepository.findOne({
      where: { id: user.id },
      relations: { teacherProfile: true } as any,
    });

    if (!dbUser?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required to update classes');
    }

    const existing = await this.classRepository.findOne({
      where: { id: classId },
      relations: ['teacher'],
    });

    if (!existing) {
      throw new BadRequestException('Class not found');
    }

    if (existing.teacher.id !== dbUser.id) {
      throw new ForbiddenException('You can only update your own classes');
    }

    if (typeof dto.title === 'string') {
      const trimmedTitle = dto.title.trim();
      if (!trimmedTitle) {
        throw new BadRequestException('Title cannot be empty');
      }
      existing.title = trimmedTitle;
    }

    if (typeof dto.category === 'string') {
      const normalizedCategory = dto.category.trim().toLowerCase();

      const approvedCategory = await this.categoryRepository.findOne({
        where: {
          slug: normalizedCategory,
          status: 'approved',
        } as any,
      });

      if (!approvedCategory) {
        throw new BadRequestException('Category is not approved');
      }

      existing.category = approvedCategory.slug;
    }

    if (typeof dto.description === 'string') {
      existing.description = dto.description.trim() || null;
    }

    if (typeof dto.price === 'number') {
      if (!Number.isFinite(dto.price) || dto.price <= 0) {
        throw new BadRequestException('Price must be greater than zero');
      }
existing.priceCents = Math.round(dto.price * 100);    }

    if (typeof dto.image_url_1 === 'string') {
      existing.image_url_1 = dto.image_url_1.trim() || null;
    }

    if (typeof dto.image_url_2 === 'string') {
      existing.image_url_2 = dto.image_url_2.trim() || null;
    }

    if (typeof dto.image_url_3 === 'string') {
      existing.image_url_3 = dto.image_url_3.trim() || null;
    }

    return this.classRepository.save(existing);
  }

  async getClassById(id: string) {
    return this.classRepository.findOne({
      where: { id },
      relations: ['teacher'],
    });
  }

  async getMyClasses(userId: string) {
    const dbUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: { teacherProfile: true } as any,
    });

    if (!dbUser?.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    return this.classRepository.find({
      where: {
        teacher: { id: userId },
      } as any,
    });
  }
}