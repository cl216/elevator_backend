import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('teacher')
export class TeacherController {
  constructor(private teacherService: TeacherService) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  createProfile(@Req() req, @Body() dto: CreateTeacherProfileDto) {
    return this.teacherService.createProfile(req.user, dto);
  }
}
