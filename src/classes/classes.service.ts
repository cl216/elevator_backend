import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './entities/class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { User } from '../users/user.entity';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private classRepository: Repository<Class>,
  ) {}

  async createClass(user: User, dto: CreateClassDto) {
    if (user.role !== 'TEACHER') {
      throw new ForbiddenException('Only teachers can create classes');
    }

    const newClass = this.classRepository.create({
      ...dto,
      teacher: user,
    });

    return this.classRepository.save(newClass);
  }

  async getClassById(id: string) {
    return this.classRepository.findOne({
      where: { id },
      relations: ['teacher'],
    });
  }
}
