import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { TeacherStripeService } from './teacher-stripe.service';

@Controller('teacher')
export class TeacherController {
  constructor(
    private teacherService: TeacherService,
    private readonly teacherStripeService: TeacherStripeService,
  ) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  createProfile(@Req() req, @Body() dto: CreateTeacherProfileDto) {
    return this.teacherService.createProfile(req.user, dto);
  }

  @Post('stripe/onboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  async stripeOnboard(@CurrentUser() user: { id: string }) {
    return this.teacherStripeService.createOrResumeOnboarding(user.id);
  }

  @Get('stripe/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  async stripeStatus(@CurrentUser() user: { id: string }) {
    return this.teacherStripeService.refreshStripeStatus(user.id);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  async followTeacher(
    @CurrentUser() user: { id: string },
    @Param('id') teacherId: string,
  ) {
    return this.teacherService.followTeacher(user.id, teacherId);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  async unfollowTeacher(
    @CurrentUser() user: { id: string },
    @Param('id') teacherId: string,
  ) {
    return this.teacherService.unfollowTeacher(user.id, teacherId);
  }

  @Get('me/following')
  @UseGuards(JwtAuthGuard)
  async getFollowing(@CurrentUser() user: { id: string }) {
    return this.teacherService.getFollowing(user.id);
  }

  @Get(':id/follow-status')
  @UseGuards(JwtAuthGuard)
  async getFollowStatus(
    @CurrentUser() user: { id: string },
    @Param('id') teacherId: string,
  ) {
    return this.teacherService.getFollowStatus(user.id, teacherId);
  }

  @Get('sessions/:id/bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  async getSessionBookings(
    @CurrentUser() user: { id: string },
    @Param('id') sessionId: string,
  ) {
    return this.teacherService.getSessionBookingsForTeacher(sessionId, user.id);
  }

  @Get('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER')
  async getMyProfile(@CurrentUser() user: { id: string }) {
    return this.teacherService.getMyProfile(user.id);
  }

  @Get(':id/profile')
  async getPublicTeacherProfile(@Param('id') teacherId: string) {
    return this.teacherService.getPublicTeacherProfile(teacherId);
  }

}
