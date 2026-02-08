import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { User } from '../users/user.entity';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(TeacherProfile)
    private profileRepo: Repository<TeacherProfile>,
  ) {}

  async createProfile(user: User, dto: CreateTeacherProfileDto) {
    const profile = this.profileRepo.create({ ...dto, user });
    return this.profileRepo.save(profile);
  }
}
