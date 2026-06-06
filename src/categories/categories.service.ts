import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { User } from '../users/user.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async getApprovedCategories() {
    const rows = await this.categoriesRepository.find({
      where: { status: 'approved' as any },
      order: { label: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
    }));
  }

  async proposeCategory(userId: string, label: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { teacherProfile: true } as any,
    });

    if (!user?.teacherProfile) {
      throw new BadRequestException('Teacher profile required');
    }

    const cleanedLabel = label.trim();
    const slug = this.slugify(cleanedLabel);

    if (!slug) {
      throw new BadRequestException('Invalid category name');
    }

    const existing = await this.categoriesRepository.findOne({
      where: { slug },
    });

    if (existing) {
      if (existing.status === 'approved') {
        throw new BadRequestException('This category already exists');
      }

      throw new BadRequestException('This category has already been proposed');
    }

    const category = this.categoriesRepository.create({
      slug,
      label: cleanedLabel,
status: 'approved',
      created_by: user,
    });

    const saved = await this.categoriesRepository.save(category);

    return {
      id: saved.id,
      slug: saved.slug,
      label: saved.label,
      status: saved.status,
message: 'Category created',
    };
  }
}